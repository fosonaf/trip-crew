import pool from '../config/database';

const createTables = async (): Promise<void> => {
  try {
    console.log('Starting database migration...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table created');

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