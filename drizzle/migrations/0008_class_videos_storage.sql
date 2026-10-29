CREATE POLICY "tutor uploads class videos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'class-videos' AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id::text = (storage.foldername(name))[1] AND c.tutor_id = auth.uid()));
CREATE POLICY "tutor reads class videos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'class-videos' AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id::text = (storage.foldername(name))[1] AND c.tutor_id = auth.uid()));
CREATE POLICY "tutor deletes class videos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'class-videos' AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id::text = (storage.foldername(name))[1] AND c.tutor_id = auth.uid()));