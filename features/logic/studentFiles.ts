import { createAdminClient } from '@features/logic/supabase/admin';
import { createClient } from '@features/logic/supabase/server';

/** A row of public.student_files: a copy of a student's stats file. */
export type StudentFile = {
  student_id: string;
  student_email: string;
  /** The whole stats file, as in student_stats.markdown (see features/logic/backend.md). */
  content: string;
  updated_at: string;
};

/** Uploads a student's file. Uses the secret key, because users can't write this table. */
export async function saveStudentFile(file: StudentFile): Promise<void> {
  const { error } = await createAdminClient().from('student_files').upsert(file);
  if (error) {
    throw new Error(`Could not upload the file for ${file.student_id}: ${error.message}`);
  }
}

/**
 * The student files the logged-in user may see, most recently updated first. It
 * runs as that user, so Row Level Security decides: teachers get everyone's,
 * students their own.
 */
export async function listStudentFiles(): Promise<StudentFile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('student_files')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(
      `Could not load student files: ${error.message}. If the table is missing, run features/logic/migrations/*.sql in the Supabase SQL Editor.`,
    );
  }
  return data as StudentFile[];
}
