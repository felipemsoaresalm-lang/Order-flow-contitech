CREATE POLICY "order_attach_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'order-attachments');
CREATE POLICY "order_attach_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-attachments' AND owner = auth.uid());
CREATE POLICY "order_attach_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'order-attachments' AND owner = auth.uid());