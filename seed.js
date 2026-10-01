import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Province from './models/Province.js';
import District from './models/District.js';
import GridSubstation from './models/GridSubstation.js';
import SolarInstallation from './models/SolarInstallation.js';
import GenerationReading from './models/GenerationReading.js';
import User from './models/User.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔄 Cleaning existing collections...');

    await Province.deleteMany({});
    await District.deleteMany({});
    await GridSubstation.deleteMany({});
    await SolarInstallation.deleteMany({});
    await GenerationReading.deleteMany({});
    await User.deleteMany({});

    console.log('🌱 Inserting Provinces & Districts...');
    
    // 1. 9 Provinces
    const provincesData = [
      { code: 'WP', name: 'Western Province' },
      { code: 'CP', name: 'Central Province' },
      { code: 'SP', name: 'Southern Province' },
      { code: 'NP', name: 'Northern Province' },
      { code: 'EP', name: 'Eastern Province' },
      { code: 'NW', name: 'North Western Province' },
      { code: 'NC', name: 'North Central Province' },
      { code: 'UP', name: 'Uva Province' },
      { code: 'SB', name: 'Sabaragamuwa Province' }
    ];
    await Province.insertMany(provincesData);

    // 2. 25 Districts
    const districtsData = [
      { code: 'COL', name: 'Colombo', province_code: 'WP' },
      { code: 'GAM', name: 'Gampaha', province_code: 'WP' },
      { code: 'KAL', name: 'Kalutara', province_code: 'WP' },
      { code: 'KAN', name: 'Kandy', province_code: 'CP' },
      { code: 'MAT', name: 'Matale', province_code: 'CP' },
      { code: 'NUE', name: 'Nuwara Eliya', province_code: 'CP' },
      { code: 'GAL', name: 'Galle', province_code: 'SP' },
      { code: 'MTR', name: 'Matara', province_code: 'SP' },
      { code: 'HAM', name: 'Hambantota', province_code: 'SP' },
      { code: 'JAF', name: 'Jaffna', province_code: 'NP' },
      { code: 'KIL', name: 'Kilinochchi', province_code: 'NP' },
      { code: 'MAN', name: 'Mannar', province_code: 'NP' },
      { code: 'VAV', name: 'Vavuniya', province_code: 'NP' },
      { code: 'MUL', name: 'Mullaitivu', province_code: 'NP' },
      { code: 'BAT', name: 'Batticaloa', province_code: 'EP' },
      { code: 'AMP', name: 'Ampara', province_code: 'EP' },
      { code: 'TRI', name: 'Trincomalee', province_code: 'EP' },
      { code: 'KUR', name: 'Kurunegala', province_code: 'NW' },
      { code: 'PUT', name: 'Puttalam', province_code: 'NW' },
      { code: 'ANU', name: 'Anuradhapura', province_code: 'NC' },
      { code: 'POL', name: 'Polonnaruwa', province_code: 'NC' },
      { code: 'BAD', name: 'Badulla', province_code: 'UP' },
      { code: 'MON', name: 'Moneragala', province_code: 'UP' },
      { code: 'RAT', name: 'Ratnapura', province_code: 'SB' },
      { code: 'KEG', name: 'Kegalle', province_code: 'SB' }
    ];
    await District.insertMany(districtsData);

    console.log('⚡ Inserting Grid Substations & 200+ Solar Sites...');
    
    // 3. Grid Substations & 200+ Installations
    const substations = [];
    const installations = [];

    districtsData.forEach((dist, idx) => {
      const gssCode = `GSS_${dist.code}_01`;
      substations.push({
        code: gssCode,
        name: `${dist.name} Primary Grid Substation`,
        district_code: dist.code
      });

      // 8 to 9 sites per district = 200+ sites overall
      for (let i = 1; i <= 9; i++) {
        const instId = `SOL_${dist.code}_${String(i).padStart(3, '0')}`;
        installations.push({
          installation_id: instId,
          owner_name: `Solar Producer ${dist.name} #${i}`,
          capacity_kw: Math.floor(Math.random() * 50) + 10,
          meter_id: `MTR-${instId}`,
          substation_code: gssCode
        });
      }
    });

    await GridSubstation.insertMany(substations);
    await SolarInstallation.insertMany(installations);

    console.log('📈 Generating Generation Readings (Time Series Data)...');

    // 4. Time Series Generation Readings (Diurnal curve - daytime high, night zero)
    const readings = [];
    const now = new Date();

    // Generating readings for the past 3 days (1-hour intervals)
    for (let inst of installations.slice(0, 50)) { // Sample subset to populate instantly
      let cumulativeKwh = 0;
      for (let h = 72; h >= 0; h--) {
        const time = new Date(now.getTime() - h * 3600 * 1000);
        const hour = time.getHours();

        // Solar diurnal curve: 6 AM to 6 PM output
        let kw = 0;
        if (hour >= 6 && hour <= 18) {
          const peak = Math.sin(((hour - 6) / 12) * Math.PI);
          kw = parseFloat((peak * inst.capacity_kw * (0.8 + Math.random() * 0.2)).toFixed(2));
        }

        cumulativeKwh += parseFloat((kw * 1).toFixed(2));

        readings.push({
          installation_id: inst.installation_id,
          timestamp: time,
          instantaneous_kw: kw,
          cumulative_kwh: parseFloat(cumulativeKwh.toFixed(2)),
          voltage: kw > 0 ? 230 + Math.floor(Math.random() * 10) : 0
        });
      }
    }

    await GenerationReading.insertMany(readings);

    console.log('👤 Inserting Users...');
    await User.insertMany([
      { username: 'officer_colombo', password: 'password123', role: 'READ_CLIENT', jurisdiction_scope: 'COL' },
      { username: 'officer_western', password: 'password123', role: 'READ_CLIENT', jurisdiction_scope: 'WP' },
      { username: 'officer_national', password: 'password123', role: 'READ_CLIENT', jurisdiction_scope: 'ALL' },
      { username: 'metering_device_01', password: 'devicepass123', role: 'WRITE_CLIENT', jurisdiction_scope: 'ALL' }
    ]);

    console.log('✅ Seed Data Created Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error Seeding Data:', error);
    process.exit(1);
  }
};

seedDatabase();