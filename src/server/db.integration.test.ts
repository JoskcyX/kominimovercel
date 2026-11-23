// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- test helpers deal in loosely typed rows */
/**
 * Database security & behaviour tests. They run against a REAL Postgres, as the real
 * least-privilege role (`app_runtime`), and only when TEST_DATABASE_URL is set:
 *
 *   createdb kominimo_test && DATABASE_URL_MIGRATIONS=postgres://… npm run db:migrate
 *   TEST_DATABASE_URL=postgres://… npm test
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env["TEST_DATABASE_URL"];
const d = url ? describe : describe.skip;

d("database security model", () => {
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  afterAll(() => pool.end());

  /** Run a callback as app_runtime with the given user (null = anonymous), in one transaction. */
  async function as<T>(
    uid: string | null,
    fn: (q: pg.PoolClient["query"]) => Promise<T>,
    system = "",
  ): Promise<T> {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE app_runtime");
      await c.query(
        "SELECT set_config('app.user_id', $1, true), set_config('app.system', $2, true)",
        [uid ?? "", system],
      );
      const out = await fn(c.query.bind(c) as pg.PoolClient["query"]);
      await c.query("COMMIT");
      return out;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  const rows = async (uid: string | null, sql: string, params: unknown[] = [], system = "") =>
    as(uid, async (q) => (await q(sql, params)).rows as any[], system);

  const tutorA = randomUUID();
  const tutorB = randomUUID();
  const student = randomUUID();
  const adminId = randomUUID();

  beforeAll(async () => {
    // Start clean — but ONLY ever on a throwaway database.
    const owner0 = await pool.connect();
    const dbName = (await owner0.query("SELECT current_database() AS n")).rows[0].n as string;
    if (!/test/i.test(dbName))
      throw new Error(
        `Refusing to run destructive tests on database "${dbName}" (name must contain "test").`,
      );
    await owner0.query(
      "TRUNCATE public.profiles, public.rate_limits, public.audit_log, public.contact_messages, public.subscription_events, public.referral_earnings CASCADE",
    );
    owner0.release();
    for (const [id, email] of [
      [tutorA, "a"],
      [tutorB, "b"],
      [student, "s"],
      [adminId, "admin"],
    ] as const) {
      await rows(id, "SELECT * FROM app.touch_profile($1, $2)", [
        `${email}-${id}@test.dev`,
        `User ${email}`,
      ]);
    }
    const owner = await pool.connect();
    await owner.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')", [
      adminId,
    ]);
    owner.release();
  });

  describe("privilege escalation (all of these worked against the old schema)", () => {
    it("a user cannot grant themselves Pro", async () => {
      await expect(
        rows(tutorA, "UPDATE public.profiles SET plan = 'pro' WHERE id = $1", [tutorA]),
      ).rejects.toThrow(/permission denied/i);
    });
    it("a user cannot rewrite referral earnings or subscription events", async () => {
      await expect(
        rows(tutorA, "UPDATE public.referral_earnings SET amount_cents = 1"),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        rows(tutorA, "INSERT INTO public.subscription_events (tutor_id, event) VALUES ($1,'x')", [
          tutorA,
        ]),
      ).rejects.toThrow(/permission denied/i);
    });
    it("the payment function refuses to run outside the trusted payment context", async () => {
      await expect(
        rows(tutorA, "SELECT public.activate_tutor_pro($1, 100, 'NGN', 0.2, 1000)", [tutorA]),
      ).rejects.toThrow(/forbidden/);
      await rows(
        tutorA,
        "SELECT public.activate_tutor_pro($1, 100, 'NGN', 0.2, 1000)",
        [tutorA],
        "payment",
      );
      const p = await rows(tutorA, "SELECT plan FROM public.profiles WHERE id=$1", [tutorA]);
      expect(p[0]?.plan).toBe("pro");
    });
    it("only an admin can use admin functions", async () => {
      await expect(rows(tutorA, "SELECT * FROM public.admin_stats()")).rejects.toThrow(/forbidden/);
      const s = await rows(adminId, "SELECT * FROM public.admin_stats()");
      expect(Number(s[0]?.users)).toBeGreaterThanOrEqual(4);
    });
    it("students (anonymous) can't read or write tables directly", async () => {
      await expect(
        rows(
          null,
          "INSERT INTO public.participants (quiz_id,name,phone,consent_version) VALUES (gen_random_uuid(),'x','1','v')",
        ),
      ).rejects.toThrow();
      expect(await rows(null, "SELECT * FROM public.quizzes")).toHaveLength(0);
      expect(await rows(null, "SELECT * FROM public.class_members")).toHaveLength(0);
    });
  });

  describe("tenant isolation", () => {
    it("a tutor never sees another tutor's quizzes, classes or students", async () => {
      await rows(
        tutorA,
        "INSERT INTO public.quizzes (tutor_id,title,join_code) VALUES ($1,'A quiz','AAAAAA')",
        [tutorA],
      );
      await rows(
        tutorA,
        "INSERT INTO public.classes (tutor_id,title,join_code) VALUES ($1,'A class','CCCCCC')",
        [tutorA],
      );
      expect(await rows(tutorB, "SELECT * FROM public.quizzes")).toHaveLength(0);
      expect(await rows(tutorB, "SELECT * FROM public.classes")).toHaveLength(0);
      await expect(
        rows(
          tutorB,
          "INSERT INTO public.quizzes (tutor_id,title,join_code) VALUES ($1,'x','BBBBBB')",
          [tutorA],
        ),
      ).rejects.toThrow();
    });
    it("cannot link another tutor's quiz into your class", async () => {
      const [cls] = await rows(
        tutorB,
        "INSERT INTO public.classes (tutor_id,title,join_code) VALUES ($1,'B class','CCCCCD') RETURNING id",
        [tutorB],
      );
      const [quiz] = await rows(tutorA, "SELECT id FROM public.quizzes LIMIT 1");
      await expect(
        rows(tutorB, "INSERT INTO public.class_quizzes (class_id,quiz_id) VALUES ($1,$2)", [
          cls?.id,
          quiz?.id,
        ]),
      ).rejects.toThrow();
    });
  });

  describe("quiz integrity", () => {
    let quizId = "";
    let q1 = "";
    let q2 = "";
    let pid = "";
    it("students must consent to join", async () => {
      const [qz] = await rows(
        tutorA,
        "INSERT INTO public.quizzes (tutor_id,title,join_code) VALUES ($1,'Live','LIVE22') RETURNING id",
        [tutorA],
      );
      quizId = qz?.id;
      const a = await rows(
        tutorA,
        "INSERT INTO public.questions (quiz_id,order_index,type,prompt,options,correct_answer,time_limit) VALUES ($1,1,'multiple_choice','2+2?','[\"3\",\"4\"]','4',30) RETURNING id",
        [quizId],
      );
      const b = await rows(
        tutorA,
        "INSERT INTO public.questions (quiz_id,order_index,type,prompt,options,correct_answer,time_limit) VALUES ($1,2,'short_answer','Capital of Nigeria?','[]','Abuja',30) RETURNING id",
        [quizId],
      );
      q1 = a[0]?.id;
      q2 = b[0]?.id;
      await rows(tutorA, "UPDATE public.quizzes SET status='lobby' WHERE id=$1", [quizId]);
      await expect(
        rows(null, "SELECT public.join_quiz($1,'Ada Obi','08012345678','')", [quizId]),
      ).rejects.toThrow(/consent_required/);
      const r = await rows(
        null,
        "SELECT public.join_quiz($1,'Ada Obi','08012345678','2026-11-08') AS id",
        [quizId],
      );
      pid = r[0]?.id;
      expect(pid).toBeTruthy();
    });
    it("the public question list never contains answers, and is hidden until the quiz is live", async () => {
      expect(
        await rows(null, "SELECT * FROM public.get_quiz_questions($1)", [quizId]),
      ).toHaveLength(0);
      await rows(tutorA, "UPDATE public.quizzes SET status='live', started_at=now() WHERE id=$1", [
        quizId,
      ]);
      const qs = await rows(null, "SELECT * FROM public.get_quiz_questions($1)", [quizId]);
      expect(qs).toHaveLength(2);
      expect(Object.keys(qs[0] ?? {})).not.toContain("correct_answer");
    });
    it("the database sets the question clock", async () => {
      const [q] = await rows(
        tutorA,
        "SELECT question_started_at, question_deadline_at FROM public.quizzes WHERE id=$1",
        [quizId],
      );
      expect(q?.question_started_at).toBeTruthy();
      expect(
        new Date(q?.question_deadline_at).getTime() - new Date(q?.question_started_at).getTime(),
      ).toBeGreaterThan(29_000);
    });
    it("cannot answer a question that hasn't been shown yet", async () => {
      await expect(
        rows(null, "SELECT public.submit_answer($1,$2,'Abuja')", [pid, q2]),
      ).rejects.toThrow(/question_not_open/);
    });
    it("cannot see the answer key before answering, and not at all unless reveal is on", async () => {
      expect(
        (await rows(null, "SELECT public.get_answer_key($1,$2) AS k", [pid, q1]))[0]?.k,
      ).toBeNull();
    });
    it("time is measured by the server, not claimed by the client", async () => {
      await new Promise((r) => setTimeout(r, 1200));
      const ok = await rows(null, "SELECT public.submit_answer($1,$2,'4') AS ok", [pid, q1]);
      expect(ok[0]?.ok).toBe(true);
      const [a] = await rows(
        tutorA,
        "SELECT time_ms FROM public.answers WHERE participant_id=$1 AND question_id=$2",
        [pid, q1],
      );
      expect(a?.time_ms).toBeGreaterThanOrEqual(1000);
    });
    it("resubmitting can't be used as an oracle: the first result stands", async () => {
      const again = await rows(null, "SELECT public.submit_answer($1,$2,'3') AS ok", [pid, q1]);
      expect(again[0]?.ok).toBe(true);
      const [p] = await rows(tutorA, "SELECT score FROM public.participants WHERE id=$1", [pid]);
      expect(p?.score).toBe(1);
    });
    it("the answer key is shown only after answering AND only when reveal is on", async () => {
      expect(
        (await rows(null, "SELECT public.get_answer_key($1,$2) AS k", [pid, q1]))[0]?.k,
      ).toBeNull();
      await rows(tutorA, "UPDATE public.quizzes SET reveal_answers=true WHERE id=$1", [quizId]);
      expect((await rows(null, "SELECT public.get_answer_key($1,$2) AS k", [pid, q1]))[0]?.k).toBe(
        "4",
      );
      expect(
        (await rows(null, "SELECT public.get_answer_key($1,$2) AS k", [pid, q2]))[0]?.k,
      ).toBeNull();
    });
    it("the public leaderboard exposes no phone numbers", async () => {
      const board = await rows(null, "SELECT * FROM public.get_quiz_board($1)", [quizId]);
      expect(board[0]).toBeDefined();
      expect(Object.keys(board[0] ?? {})).not.toContain("phone");
    });
  });

  describe("class capacity (free plan cap)", () => {
    let classId = "";
    it("auto-admit stops at the limit; the rest wait", async () => {
      const [c] = await rows(
        tutorB,
        "INSERT INTO public.classes (tutor_id,title,join_code,admit_mode,member_limit) VALUES ($1,'Cap','CAP222','auto',2) RETURNING id",
        [tutorB],
      );
      classId = c?.id;
      const res: string[] = [];
      for (const n of ["111", "222", "333"]) {
        const r = await rows(
          null,
          "SELECT * FROM public.request_class_join($1,$2,$3,'2026-11-08')",
          [classId, `Student ${n}`, `0800000${n}`],
        );
        res.push(r[0]?.status);
      }
      expect(res).toEqual(["approved", "approved", "pending"]);
    });
    it("a tutor can't approve past the limit, and admit_pending respects it", async () => {
      const [m] = await rows(
        tutorB,
        "SELECT id FROM public.class_members WHERE class_id=$1 AND status='pending'",
        [classId],
      );
      await expect(
        rows(tutorB, "UPDATE public.class_members SET status='approved' WHERE id=$1", [m?.id]),
      ).rejects.toThrow(/class_full/);
      expect((await rows(tutorB, "SELECT public.admit_pending($1) AS n", [classId]))[0]?.n).toBe(0);
      await expect(
        rows(tutorB, "UPDATE public.classes SET member_limit=9999 WHERE id=$1", [classId]),
      ).rejects.toThrow(/permission denied/i);
    });
    it("upgrading the plan lifts the limit", async () => {
      await rows(adminId, "SELECT public.admin_set_user_plan($1,'pro',1000)", [tutorB]);
      expect((await rows(tutorB, "SELECT public.admit_pending($1) AS n", [classId]))[0]?.n).toBe(1);
    });
    it("a class rep sees only masked identifiers", async () => {
      const [m] = await rows(
        tutorB,
        "SELECT id FROM public.class_members WHERE class_id=$1 ORDER BY joined_at LIMIT 1",
        [classId],
      );
      await rows(tutorB, "UPDATE public.classes SET rep_member_id=$1 WHERE id=$2", [
        m?.id,
        classId,
      ]);
      const list = await rows(null, "SELECT * FROM public.rep_members($1)", [m?.id]);
      expect(list.length).toBeGreaterThan(0);
      for (const r of list) expect(r.phone).toMatch(/\*/);
    });
  });

  describe("courses", () => {
    it("paid lesson content is withheld from non-enrolled users, and can't be self-enrolled", async () => {
      const [c] = await rows(
        tutorA,
        "INSERT INTO public.courses (tutor_id,title,slug,price_cents,is_published) VALUES ($1,'Paid','paid-1',500000,true) RETURNING id",
        [tutorA],
      );
      await rows(
        tutorA,
        "INSERT INTO public.lessons (course_id,title,kind,body) VALUES ($1,'L1','text','SECRET CONTENT')",
        [c?.id],
      );
      expect(await rows(student, "SELECT * FROM public.lessons")).toHaveLength(0); // not directly readable
      const seen = await rows(student, "SELECT * FROM public.get_course_lessons($1)", [c?.id]);
      expect(seen[0]?.locked).toBe(true);
      expect(seen[0]?.body).toBe("");
      await expect(rows(student, "SELECT public.enroll_in_course($1)", [c?.id])).rejects.toThrow(
        /payment_required/,
      );
      await expect(
        rows(
          student,
          "INSERT INTO public.enrollments (course_id,student_id,status) VALUES ($1,$2,'paid')",
          [c?.id, student],
        ),
      ).rejects.toThrow(/permission denied/i);
      const owner = await rows(tutorA, "SELECT * FROM public.get_course_lessons($1)", [c?.id]);
      expect(owner[0]?.body).toBe("SECRET CONTENT");
    });
    it("rejects non-https cover images (stops javascript: / data: URLs)", async () => {
      await expect(
        rows(
          tutorA,
          "INSERT INTO public.courses (tutor_id,title,slug,cover_url) VALUES ($1,'x','x-1','javascript:alert(1)')",
          [tutorA],
        ),
      ).rejects.toThrow();
    });
  });

  describe("platform services", () => {
    it("rate limiting counts per bucket and window", async () => {
      const b = `t-${randomUUID()}`;
      const got: boolean[] = [];
      for (let i = 0; i < 4; i++)
        got.push((await rows(null, "SELECT app.rate_limit($1, 60, 3) AS ok", [b]))[0]?.ok);
      expect(got).toEqual([true, true, true, false]);
    });
    it("legal acceptance is versioned: a new version needs a new acceptance", async () => {
      const cur = async (t: string, p: string) =>
        (await rows(student, "SELECT app.legal_current($1,$2) AS ok", [t, p]))[0]?.ok;
      expect(await cur("v1", "v1")).toBe(false);
      await rows(student, "SELECT app.accept_legal('v1','v1','hash','ua')");
      expect(await cur("v1", "v1")).toBe(true);
      expect(await cur("v2", "v1")).toBe(false);
    });
    it("contact messages are write-only for the public and readable only by admins", async () => {
      await rows(
        null,
        "SELECT public.submit_contact('Ada','ada@x.dev','support','Hello, I need help.','h')",
      );
      expect(await rows(tutorA, "SELECT * FROM public.contact_messages")).toHaveLength(0);
      const list = await rows(adminId, "SELECT * FROM public.admin_list_contact(NULL, 10)");
      expect(list.length).toBeGreaterThan(0);
    });
    it("erasing an account removes the person and everything they own", async () => {
      const victim = randomUUID();
      await rows(victim, "SELECT * FROM app.touch_profile('v@x.dev','Victim')");
      await rows(
        victim,
        "INSERT INTO public.quizzes (tutor_id,title,join_code) VALUES ($1,'gone','GONE22')",
        [victim],
      );
      await rows(victim, "SELECT public.erase_my_account()");
      const c = await pool.connect();
      expect((await c.query("SELECT 1 FROM public.profiles WHERE id=$1", [victim])).rowCount).toBe(
        0,
      );
      expect(
        (await c.query("SELECT 1 FROM public.quizzes WHERE tutor_id=$1", [victim])).rowCount,
      ).toBe(0);
      c.release();
    });
  });

  describe("performance functions (behaviour must match the slow versions they replaced)", () => {
    const owner = randomUUID();
    let cid = "";
    const members: string[] = [];

    it("class_snapshot gives the whole class in one query, and nothing for an unknown member", async () => {
      await rows(owner, "SELECT * FROM app.touch_profile('own@x.dev','Owner')");
      const [c] = await rows(
        owner,
        "INSERT INTO public.classes (tutor_id,title,join_code,admit_mode,member_limit) VALUES ($1,'Snap','SNAP22','auto',300) RETURNING id",
        [owner],
      );
      cid = c?.id;
      await rows(
        owner,
        "INSERT INTO public.class_resources (class_id,title,kind,url,visible) VALUES ($1,'Slides','link','https://x.dev/a',true),($1,'Hidden','link','https://x.dev/b',false)",
        [cid],
      );
      for (let i = 0; i < 40; i++) {
        const r = await rows(null, "SELECT * FROM public.request_class_join($1,$2,$3,'v')", [
          cid,
          `Student ${i}`,
          `0803000${String(i).padStart(4, "0")}`,
        ]);
        members.push(r[0]?.member_id);
      }
      const [snap] = await rows(null, "SELECT public.class_snapshot($1) AS s", [members[0]]);
      expect(Object.keys(snap.s.members)).toHaveLength(40);
      expect(snap.s.members[members[3] as string][0]).toBe("approved");
      expect(snap.s.resources.map((r: any) => r.title)).toEqual(["Slides"]); // hidden ones are never included
      expect(
        (await rows(null, "SELECT public.class_snapshot($1) AS s", [randomUUID()]))[0]?.s,
      ).toBeNull();
    });

    it("a returning student is recognised however they format their number (indexed, not regex-scanned)", async () => {
      const again = await rows(
        null,
        "SELECT * FROM public.request_class_join($1,'Student 5','0803 000-0005 ','v')",
        [cid],
      );
      expect(again[0]?.member_id).toBe(members[5]);
      const [{ n }] = await rows(
        owner,
        "SELECT count(*)::int AS n FROM public.class_members WHERE class_id=$1",
        [cid],
      );
      expect(n).toBe(40);
    });

    it("attendance heartbeats from many students run at the same time and all count", async () => {
      await rows(
        owner,
        "UPDATE public.classes SET live_room_name='r', live_room_url='https://x.dev/r', session_started_at=now() WHERE id=$1",
        [cid],
      );
      await Promise.all(
        members.map((m) => rows(null, "SELECT public.live_heartbeat($1,true)", [m])),
      );
      await new Promise((r) => setTimeout(r, 1100));
      await Promise.all(
        members.map((m) => rows(null, "SELECT public.live_heartbeat($1,true)", [m])),
      );
      const att = await rows(
        owner,
        "SELECT present_seconds FROM public.class_session_attendance a JOIN public.class_sessions s ON s.id=a.session_id WHERE s.class_id=$1",
        [cid],
      );
      expect(att).toHaveLength(40);
      expect(att.every((a) => a.present_seconds >= 1)).toBe(true);
    });

    it("the flood guard stops unbounded waiting-room growth", async () => {
      const [c] = await rows(
        owner,
        "INSERT INTO public.classes (tutor_id,title,join_code,admit_mode,member_limit) VALUES ($1,'Flood','FLOOD2','manual',1) RETURNING id",
        [owner],
      );
      // cap = max(3 × limit, 500) = 500: seed 500 directly, the 501st through the function must be refused
      const c0 = await pool.connect();
      await c0.query(
        "INSERT INTO public.class_members (class_id,name,phone,status,consent_version) SELECT $1,'n'||g,'0900'||g,'pending','v' FROM generate_series(1,500) g",
        [c?.id],
      );
      c0.release();
      await expect(
        rows(null, "SELECT * FROM public.request_class_join($1,'Late Comer','09991234567','v')", [
          c?.id,
        ]),
      ).rejects.toThrow(/class_full/);
    });

    describe("quiz scoring and leaderboards", () => {
      let qz = "";
      const pids: string[] = [];
      const qids: string[] = [];
      it("incremental scoring equals the true count, and a repeated submit never double-counts", async () => {
        const [z] = await rows(
          owner,
          "INSERT INTO public.quizzes (tutor_id,title,join_code) VALUES ($1,'Board','BOARD2') RETURNING id",
          [owner],
        );
        qz = z?.id;
        for (let i = 1; i <= 3; i++) {
          const [q] = await rows(
            owner,
            "INSERT INTO public.questions (quiz_id,order_index,type,prompt,options,correct_answer,time_limit) VALUES ($1,$2,'multiple_choice','q','[\"a\",\"b\"]','a',60) RETURNING id",
            [qz, i],
          );
          qids.push(q?.id);
        }
        await rows(owner, "UPDATE public.quizzes SET status='lobby' WHERE id=$1", [qz]);
        for (let i = 0; i < 60; i++)
          pids.push(
            (
              await rows(null, "SELECT public.join_quiz($1,$2,$3,'v') AS id", [
                qz,
                `P${i}`,
                `0701000${String(i).padStart(4, "0")}`,
              ])
            )[0]?.id,
          );
        await rows(owner, "UPDATE public.quizzes SET status='live', started_at=now() WHERE id=$1", [
          qz,
        ]);
        // everyone answers question 1; the first 10 correctly
        await Promise.all(
          pids.map((p, i) =>
            rows(null, "SELECT public.submit_answer($1,$2,$3)", [p, qids[0], i < 10 ? "a" : "b"]),
          ),
        );
        // and the same answer arrives twice, concurrently, for one student
        await Promise.all(
          [1, 2, 3].map(() =>
            rows(null, "SELECT public.submit_answer($1,$2,'a')", [pids[0], qids[0]]),
          ),
        );
        const sc = await rows(
          owner,
          "SELECT p.score, (SELECT count(*)::int FROM public.answers a WHERE a.participant_id=p.id AND a.is_correct) AS truth FROM public.participants p WHERE p.quiz_id=$1",
          [qz],
        );
        expect(sc.every((r) => r.score === r.truth)).toBe(true);
        expect(sc.filter((r) => r.score === 1)).toHaveLength(10);
      });
      it("the capped leaderboard returns only the top N, correctly ranked, plus the total", async () => {
        const top = await rows(null, "SELECT * FROM public.get_quiz_board_top($1, 5)", [qz]);
        expect(top).toHaveLength(5);
        expect(top.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
        expect(top.every((r) => r.total === 60 && r.score === 1)).toBe(true);
      });
      it("a student outside the top N still gets their exact rank", async () => {
        const [me] = await rows(null, "SELECT * FROM public.get_my_rank($1)", [pids[59]]);
        expect(me.total).toBe(60);
        expect(me.score).toBe(0);
        expect(me.rank).toBeGreaterThan(10); // everyone with a point ranks above them
        const all = await rows(null, "SELECT id FROM public.get_quiz_board($1)", [qz]);
        expect(all.findIndex((r) => r.id === pids[59]) + 1).toBe(me.rank); // matches the full sort
      });
    });
  });
});
