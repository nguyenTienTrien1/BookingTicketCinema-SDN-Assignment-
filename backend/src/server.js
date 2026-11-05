import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";
const port = process.env.PORT || 3000;
connectDatabase()
  .then(() =>
    app.listen(port, () =>
      console.log(`API running at http://localhost:${port}`),
    ),
  )
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
