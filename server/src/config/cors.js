const env = require('./environment');

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const isVercel = /\.vercel\.app$/.test(origin);
    const isAllowedCustom = env.ALLOWED_ORIGINS.includes(origin);
    
    if (isLocalhost || isVercel || isAllowedCustom) {
      callback(null, true);
    } else {
      if (env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200, // Safari compatibility
};

module.exports = corsOptions;
