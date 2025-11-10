import pool from '../config/database';

const createTables = async (): Promise<void> => {
  try {
    console.log('Starting database migration...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table created');

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);
    await pool.query(`UPDATE users SET phone = CONCAT('TMP-', id) WHERE phone IS NULL OR phone = ''`);
    await pool.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`);
    await pool.query(`ALTER TABLE users ALTER COLUMN phone SET NOT NULL`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx ON users(phone)`);

    await pool.query(`ALTER TABLE event_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`);
    await pool.query(`UPDATE event_members SET status = 'active' WHERE status IS NULL`);
    await pool.query(`ALTER TABLE event_members ALTER COLUMN status SET NOT NULL`);
    await pool.query(`ALTER TABLE event_members ADD COLUMN IF NOT EXISTS invited_by INTEGER REFERENCES users(id)`);
    await pool.query(`ALTER TABLE event_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await pool.query(`CREATE INDEX IF NOT EXISTS event_members_status_idx ON event_members(status)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        location VARCHAR(255),
        is_paid BOOLEAN DEFAULT FALSE,
        price DECIMAL(10, 2),
        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Events table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_members (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        payment_status VARCHAR(50) DEFAULT 'pending',
        qr_code TEXT,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
      )
    `);
    console.log('Event members table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_join_requests (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS event_join_requests_event_idx ON event_join_requests(event_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS event_join_requests_status_idx ON event_join_requests(status)`);
    console.log('Event join requests table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_steps (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        scheduled_time TIMESTAMP NOT NULL,
        alert_before_minutes INTEGER DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Event steps table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS check_ins (
        id SERIAL PRIMARY KEY,
        step_id INTEGER REFERENCES event_steps(id) ON DELETE CASCADE,
        member_id INTEGER REFERENCES event_members(id) ON DELETE CASCADE,
        checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checked_by INTEGER REFERENCES users(id),
        UNIQUE(step_id, member_id)
      )
    `);
    console.log('Check-ins table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Messages table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        step_id INTEGER REFERENCES event_steps(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Notifications table created');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_event_members_event ON event_members(event_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_event_members_user ON event_members(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_event ON messages(event_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');
    console.log('Indexes created');

    console.log('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

createTables();