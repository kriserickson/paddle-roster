-- Enable Row Level Security
ALTER TABLE IF EXISTS public.players ENABLE ROW LEVEL SECURITY;

-- Create players table
CREATE TABLE IF NOT EXISTS public.players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    skill_level DECIMAL(2,1) NOT NULL CHECK (skill_level >= 1.0 AND skill_level <= 5.0),
    partner_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS players_user_id_idx ON public.players(user_id);
CREATE INDEX IF NOT EXISTS players_name_idx ON public.players(name);
CREATE INDEX IF NOT EXISTS players_skill_level_idx ON public.players(skill_level);

-- Row Level Security Policies
-- Players can only see and modify their own data
CREATE POLICY "Users can view their own players" ON public.players
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own players" ON public.players
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own players" ON public.players
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own players" ON public.players
    FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on row updates
CREATE TRIGGER update_players_updated_at 
    BEFORE UPDATE ON public.players
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create user_preferences table for storing matching options
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    number_of_courts INTEGER DEFAULT 3 CHECK (number_of_courts >= 1 AND number_of_courts <= 4),
    number_of_rounds INTEGER DEFAULT 7 CHECK (number_of_rounds >= 1 AND number_of_rounds <= 15),
    balance_skill_levels BOOLEAN DEFAULT true,
    respect_partner_preferences BOOLEAN DEFAULT true,
    max_skill_difference DECIMAL(3,1) DEFAULT 2.0 CHECK (max_skill_difference >= 0.0 AND max_skill_difference <= 8.0),
    distribute_rest_equally BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security for user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create indexes for user_preferences
CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON public.user_preferences(user_id);

-- Row Level Security Policies for user_preferences
CREATE POLICY "Users can view their own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" ON public.user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger to automatically update updated_at on user_preferences updates
CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
