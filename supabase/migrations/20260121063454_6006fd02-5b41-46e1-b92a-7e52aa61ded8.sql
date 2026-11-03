-- Create the trigger to automatically create profiles for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create profile for the existing user who is missing one
INSERT INTO public.profiles (user_id, email, tiktok_username)
SELECT 
  id,
  email,
  'user_' || left(replace(id::text, '-', ''), 10)
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles);

-- Create user role for existing users missing roles
INSERT INTO public.user_roles (user_id, role)
SELECT 
  id,
  CASE WHEN lower(email) = 'admin@tikswap.online' THEN 'admin'::app_role ELSE 'user'::app_role END
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles);