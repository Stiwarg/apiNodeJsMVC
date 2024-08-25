import { createApp } from '../js/app.js';

import { MovieModel } from '../js/models/mysql/moviesdb.js';

createApp({ movieModel: MovieModel });