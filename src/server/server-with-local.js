import { createApp } from '../js/app.js';

import { MovieModel } from '../js/models/local-file-system/movieModel.js';

createApp({ movieModel: MovieModel });