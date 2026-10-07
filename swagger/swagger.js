import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import  { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesPath = path.join(__dirname, '../routes/*.js').replace(/\\/g, '/');


const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: "SLSEA Solar Generation Management API",
      version: "1.0.0",
      description: 
      `### Sri Lanka Sustainable Energy Authority (SLSEA) - Solar Generation API
This API provides comprehensive endpoints for managing solar installations, grid substations, regional boundaries, and generation readings telemetry.

* **Authentication**: Uses JWT Bearer Token.
* **Architecture**: RESTful JSON API.
      `,
      contact: {
        name: "SLSEA Developer Team",
        email: "support@slsea.gov.lk",
        url: "https://www.slsea.gov.lk"
      },

      license: {
        name: "MIT License",
        url: "https://opensource.org/licenses/MIT"
      } },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: "Development Server",
      },
      {
        url: "https://slsea-solar-api.onrender.com", 
        description: "Production Live Server",
      },
    ],

    tags: [
      { name: "Authentication", description: "User Authentication & JWT Token Management API" },
      { name: "Provinces", description: "Province Management API" },
      { name: "Districts", description: "District & Grid Substation Management API" },
      { name: "Installations", description: "Solar Installations Management API" },
      { name: "Readings", description: "Solar Generation Readings Management" }
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },

  apis: [routesPath],
};

const customUiOptions = {
  customSiteTitle: "SESEA API Docs",
  swaggerOptions: {
    docExpansion: "list",
    filter: true,
    persistAuthorization: true,
  },
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

export const setupSwagger = (app) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs, customUiOptions)) ;
};