import express, { json } from 'express';
import { routerMovie } from '../js/routes/moviesRoute.js';
import { corsMiddleware } from './middlewares/cors.js';

const app = express();

app.use( json() );
app.use( corsMiddleware() );

// Deshabilitar el header X-Powered-By: Express
app.disable('x-powered-by');

app.use('/movies', routerMovie);

const PORT = process.env.PORT ?? 1234;

app.listen(PORT, () => {
    console.log(`Server listening on port http://localhost:${PORT}`);
})