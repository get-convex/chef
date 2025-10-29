import { auth } from "./auth";
import router from "./storeRouter";

const http = router;

auth.addHttpRoutes(http);

export default http;
