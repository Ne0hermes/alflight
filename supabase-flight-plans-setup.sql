-- Table pour stocker les plans de vol complétés
CREATE TABLE IF NOT EXISTS flight_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Informations générales
  callsign TEXT,
  flight_type TEXT, -- VFR/IFR
  day_night TEXT, -- day/night
  flight_nature TEXT, -- local/navigation
  flight_date DATE,

  -- Aéronef
  aircraft_registration TEXT NOT NULL,
  aircraft_type TEXT,
  aircraft_model TEXT,

  -- Route
  departure_icao TEXT NOT NULL,
  departure_name TEXT,
  departure_coordinates JSONB,
  arrival_icao TEXT NOT NULL,
  arrival_name TEXT,
  arrival_coordinates JSONB,
  total_distance NUMERIC,
  estimated_time INTEGER, -- minutes

  -- Navigation complète (waypoints avec altitudes)
  navigation_waypoints JSONB NOT NULL, -- Array complet des waypoints avec segment_altitudes
  segment_altitudes JSONB, -- Altitudes par segment

  -- Déroutements
  alternates JSONB, -- Array d'aérodromes

  -- Météo
  weather_data JSONB, -- METAR/TAF pour départ/arrivée/alternates

  -- Carburant
  fuel_total_required NUMERIC,
  fuel_confirmed NUMERIC,
  fuel_breakdown JSONB, -- taxi, climb, cruise, alternate, reserve, contingency

  -- Masse et centrage
  weight_balance JSONB, -- scenarios, calculations

  -- Performances
  performance_data JSONB, -- takeoff/landing performances

  -- TOD (Top of Descent)
  tod_parameters JSONB,

  -- Données complètes du plan de vol (backup complet)
  full_flight_plan JSONB NOT NULL,

  -- Métadonnées
  version TEXT DEFAULT '1.0',
  pilot_name TEXT,
  notes TEXT
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_flight_plans_callsign ON flight_plans(callsign);
CREATE INDEX IF NOT EXISTS idx_flight_plans_registration ON flight_plans(aircraft_registration);
CREATE INDEX IF NOT EXISTS idx_flight_plans_date ON flight_plans(flight_date);
CREATE INDEX IF NOT EXISTS idx_flight_plans_completed_at ON flight_plans(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_flight_plans_departure ON flight_plans(departure_icao);
CREATE INDEX IF NOT EXISTS idx_flight_plans_arrival ON flight_plans(arrival_icao);

-- Politique RLS (Row Level Security) - lecture publique pour l'instant
ALTER TABLE flight_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON flight_plans
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access" ON flight_plans
  FOR INSERT
  WITH CHECK (true);

-- Commentaires
COMMENT ON TABLE flight_plans IS 'Plans de vol complétés avec navigation complète';
COMMENT ON COLUMN flight_plans.navigation_waypoints IS 'Array complet des waypoints avec toutes les données (nom, ICAO, coordonnées, type, altitudes)';
COMMENT ON COLUMN flight_plans.full_flight_plan IS 'Backup complet du FlightPlanData en JSON';
