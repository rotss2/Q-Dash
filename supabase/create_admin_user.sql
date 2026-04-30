-- Insert admin user into profiles table
-- Run this in your Supabase SQL Editor if the admin user doesn't exist

INSERT INTO profiles (id, email, role)
VALUES ('c6ae1256-0bda-4a98-8fcc-8765446f9d32', 'admin@example.com', 'admin')
ON CONFLICT (id) DO NOTHING;