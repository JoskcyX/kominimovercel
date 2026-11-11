import { describe, expect, it } from "vitest";
import { rawSql, setClause, sql } from "./db";

describe("sql tagged template", () => {
  it("turns every value into a numbered parameter", () => {
    const q = sql`SELECT * FROM t WHERE a = ${1} AND b = ${"x"}`;
    expect(q.text).toBe("SELECT * FROM t WHERE a = $1 AND b = $2");
    expect(q.values).toEqual([1, "x"]);
  });
  it("never lets hostile input become SQL text", () => {
    const evil = "'; DROP TABLE profiles; --";
    const q = sql`SELECT * FROM t WHERE name = ${evil}`;
    expect(q.text).not.toContain("DROP");
    expect(q.values).toEqual([evil]);
  });
  it("renumbers parameters when fragments are nested", () => {
    const inner = sql`b = ${2} AND c = ${3}`;
    const q = sql`SELECT ${1}::int FROM t WHERE ${inner} AND d = ${4}`;
    expect(q.text).toBe("SELECT $1::int FROM t WHERE b = $2 AND c = $3 AND d = $4");
    expect(q.values).toEqual([1, 2, 3, 4]);
  });
  it("inlines only explicit rawSql fragments", () => {
    expect(sql`SELECT ${rawSql("now()")}`.text).toBe("SELECT now()");
  });
});

describe("setClause", () => {
  it("builds a parameterised SET list from an allow-list", () => {
    const set = setClause({ title: "A", subject: "B", ignored: undefined }, ["title", "subject"])!;
    expect(set.text).toBe('"title" = $1, "subject" = $2');
    expect(set.values).toEqual(["A", "B"]);
  });
  it("refuses columns that aren't allow-listed (no privilege or mass-assignment tricks)", () => {
    expect(() => setClause({ plan: "pro" }, ["title"])).toThrow(/not updatable/);
    expect(() => setClause({ 'x" = 1; --': 1 }, ["title"])).toThrow();
  });
  it("returns null when there is nothing to update", () => {
    expect(setClause({}, ["title"])).toBeNull();
    expect(setClause({ title: undefined }, ["title"])).toBeNull();
  });
});
