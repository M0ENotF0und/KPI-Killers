-- Scenario-Based IT Recommendation and Cost-Optimization System
-- Database: it_recommender (PostgreSQL). 17 tables, as per Deliverable 2 schema.
CREATE TABLE IF NOT EXISTS "user" (
  user_id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student','business','consumer','admin'))
);
CREATE TABLE IF NOT EXISTS student_profile (
  student_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES "user"(user_id) ON DELETE CASCADE,
  course VARCHAR(100), est_workload VARCHAR(50)
);
CREATE TABLE IF NOT EXISTS business_profile (
  biz_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES "user"(user_id) ON DELETE CASCADE,
  service_model VARCHAR(80), team_size INT, dept_budget_kes NUMERIC(12,2), sourcing_hub VARCHAR(20)
);
CREATE TABLE IF NOT EXISTS consumer_profile (
  consumer_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES "user"(user_id) ON DELETE CASCADE,
  daily_needs VARCHAR(120), price_range VARCHAR(40), form_factor VARCHAR(30)
);
CREATE TABLE IF NOT EXISTS search_history (
  search_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  query_summary TEXT, searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_log (
  log_id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES "user"(user_id) ON DELETE SET NULL,
  action VARCHAR(60), logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS vendor (
  vendor_id SERIAL PRIMARY KEY,
  name VARCHAR(100), hub VARCHAR(20) CHECK (hub IN ('Local','Dubai')), purchase_url TEXT
);
CREATE TABLE IF NOT EXISTS product (
  product_id SERIAL PRIMARY KEY,
  vendor_id INT NOT NULL REFERENCES vendor(vendor_id),
  category VARCHAR(40), brand VARCHAR(50), specs JSONB,
  stock_qty INT CHECK (stock_qty >= 0)
);
CREATE TABLE IF NOT EXISTS price_log (
  price_id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
  price NUMERIC(12,2), currency CHAR(3), logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS saved_item (
  saved_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
  kind VARCHAR(20)
);
CREATE TABLE IF NOT EXISTS scenario (
  scenario_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  budget_cap_kes NUMERIC(12,2) CHECK (budget_cap_kes >= 0),
  brand_os_pref VARCHAR(50), storage_pref VARCHAR(30), is_saved BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS bundle (
  bundle_id SERIAL PRIMARY KEY,
  bundle_type VARCHAR(30), name VARCHAR(120), total_price_kes NUMERIC(12,2)
);
CREATE TABLE IF NOT EXISTS bundle_item (
  item_id SERIAL PRIMARY KEY,
  bundle_id INT NOT NULL REFERENCES bundle(bundle_id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
  qty INT
);
CREATE TABLE IF NOT EXISTS recommendation (
  rec_id SERIAL PRIMARY KEY,
  scenario_id INT NOT NULL REFERENCES scenario(scenario_id) ON DELETE CASCADE,
  bundle_id INT NOT NULL REFERENCES bundle(bundle_id) ON DELETE CASCADE,
  rank INT, value_score NUMERIC(5,2)
);
CREATE TABLE IF NOT EXISTS cost_parameter (
  param_id SERIAL PRIMARY KEY,
  type VARCHAR(20), value NUMERIC(12,4), effective_date DATE
);
CREATE TABLE IF NOT EXISTS landed_cost (
  lc_id SERIAL PRIMARY KEY,
  rec_id INT NOT NULL REFERENCES recommendation(rec_id) ON DELETE CASCADE,
  item_id INT NOT NULL REFERENCES bundle_item(item_id) ON DELETE CASCADE,
  param_id INT REFERENCES cost_parameter(param_id),
  duty NUMERIC(12,2), freight NUMERIC(12,2), vat NUMERIC(12,2), total_kes NUMERIC(12,2)
);
CREATE TABLE IF NOT EXISTS rule (
  rule_id SERIAL PRIMARY KEY,
  rule_type VARCHAR(40), condition JSONB, action JSONB, is_active BOOLEAN DEFAULT TRUE
);
