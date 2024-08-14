import z from 'zod';

const moviesSchema = z.object({

    title: z.string({
        invalid_type_error: 'Movie title must be a string',
        required_error: 'Movie title is required.'
    }),

    year: z.number().int().min( 1900 ).max( 2024 ),
    director: z.string({ 
        invalid_type_error: 'Movie director must be a string',
        required_error: 'Movie director is required',
    }),

    duration: z.number().int().positive(),
    rate: z.number().min( 0 ).max( 10 ).default( 5 ), 
    poster: z.string().url({
        message: 'Poster must be a valid URL'
    }),
    genre: z.array(z.enum(['Action', 'Adventure', 'Crime', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Thriller', 'Sci-fi', 'Romance', 'Animation', 'Biography',]),{
        required_error: 'Movie genre is required',
        invalid_type_error: 'Movie genre must be an array of enum Genre'
    })
});

export const validateMovie = ( input ) => {
    return moviesSchema.safeParse( input );
}

export const validatePartialMovie = ( input ) => {
    return moviesSchema.partial().safeParse( input );
}