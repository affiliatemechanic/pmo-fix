
CREATE POLICY submissions_update_admin ON public.pmo_submissions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY email_log_select_admin ON public.email_send_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
