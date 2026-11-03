-- Create trigger for new user signups (if not exists)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  initial_role public.app_role;
  animal_avatars text[];
  random_avatar text;
BEGIN
  -- Get animal avatars array
  animal_avatars := ARRAY['🦊', '🐼', '🦁', '🐯', '🐻', '🐨', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅', '🦉', '🐺', '🐗', '🐴', '🦄', '🐝', '🦋', '🐌', '🐢', '🐍', '🦎', '🦖', '🐙', '🦀', '🐠', '🐬', '🦈', '🐳'];
  
  -- Pick random avatar
  random_avatar := animal_avatars[1 + floor(random() * array_length(animal_avatars, 1))::int];
  
  -- Create profile with random avatar
  INSERT INTO public.profiles (user_id, email, first_name, last_name, tiktok_username, tiktok_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'tiktok_username', ''), 'user_' || left(replace(NEW.id::text, '-', ''), 10)),
    NEW.raw_user_meta_data ->> 'tiktok_name',
    random_avatar
  );

  -- Bootstrap admin by email
  IF lower(NEW.email) = 'admin@tikswap.online' THEN
    initial_role := 'admin'::public.app_role;
  ELSE
    initial_role := 'user'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, initial_role);

  RETURN NEW;
END;
$$;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert profile and role for existing admin@tikswap.online user (only if the auth user still exists)
INSERT INTO public.profiles (user_id, email, tiktok_username, avatar_url, tik_points)
SELECT '4859f2b3-bd12-44d5-abe5-f4418b8d3a75', 'admin@tikswap.online', 'admin_tikswap', '👑', 0
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = '4859f2b3-bd12-44d5-abe5-f4418b8d3a75')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT '4859f2b3-bd12-44d5-abe5-f4418b8d3a75', 'admin'::public.app_role
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = '4859f2b3-bd12-44d5-abe5-f4418b8d3a75')
ON CONFLICT (user_id, role) DO NOTHING;

-- Also fix the other user who signed up
INSERT INTO public.profiles (user_id, email, tiktok_username, avatar_url, tik_points)
SELECT 'd680830a-ee68-499d-90a0-0f172298b432', 'admin@gmail.com', 'user_d680830aee', '🦊', 0
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = 'd680830a-ee68-499d-90a0-0f172298b432')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT 'd680830a-ee68-499d-90a0-0f172298b432', 'user'::public.app_role
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = 'd680830a-ee68-499d-90a0-0f172298b432')
ON CONFLICT (user_id, role) DO NOTHING;