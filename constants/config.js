const corsOptions = {
  origin: ["http://localhost:5173", process.env.CLIENT_URL],
  credentials: true,
};

export { corsOptions };
