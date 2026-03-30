import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';
import { CricketIndoorCourt } from '../modules/arena/cricket-indoor/entities/cricket-indoor-court.entity';
import { FutsalField } from '../modules/arena/futsal-field/entities/futsal-field.entity';
import { PadelCourt } from '../modules/arena/padel-court/entities/padel-court.entity';
import { TurfCourt } from '../modules/arena/turf-court/entities/turf-court.entity';
import { BookingItem } from '../modules/bookings/entities/booking-item.entity';
import { Booking } from '../modules/bookings/entities/booking.entity';
import { BusinessLocation } from '../modules/businesses/entities/business-location.entity';
import { BusinessMembership } from '../modules/businesses/entities/business-membership.entity';
import { Business } from '../modules/businesses/entities/business.entity';
import { Role } from '../modules/iam/entities/role.entity';
import { UserRole } from '../modules/iam/entities/user-role.entity';
import { User } from '../modules/iam/entities/user.entity';

export const typeOrmOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'backend_saas',
  entities: [
    User,
    Role,
    UserRole,
    Business,
    BusinessLocation,
    BusinessMembership,
    CricketIndoorCourt,
    FutsalField,
    PadelCourt,
    TurfCourt,
    Booking,
    BookingItem,
  ],
  // Use DataSource-relative paths so it works after building to `dist/`.
  migrations: [join(__dirname, 'migrations', '*.js')],
};

export default new DataSource(typeOrmOptions);
