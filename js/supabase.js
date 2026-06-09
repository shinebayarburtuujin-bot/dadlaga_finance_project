import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://tacqtqhfiieanprriqwi.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_ly2VbZUbeYSDtiVdnVhOxw_IwJvebxz";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("Supabase холбогдлоо");