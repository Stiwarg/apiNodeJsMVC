import mysql from 'mysql2/promise';

const config = {
    host: 'localhost',
    user: 'root',
    port: 3307,
    password: '123456789',
    database: 'moviesdb'
}


const connection =  mysql.createPool( config );

//const connection = await mysql.createConnection( config );


export class MovieModel {

    static async getAll ({ genre }) {

        if ( genre ) {
            const lowerCaseGenre = genre.toLowerCase();

            // obtener identificadores de género de la tabla de la base de datos utilizando nombres de género

            const [ genres ] = await connection.query(
                'SELECT id, name FROM genres WHERE LOWER( name ) = ?;', [ lowerCaseGenre ]
            );

            if ( genres.length === 0 ) return [];
            
            const [{ id }] = genres;

            // Obtener todos los identificadores de las películas de la tabla de la base de datos 
            // la query a movie_genres
            // join 
            // y devolver resultados

            const [ moviesGenre ] = await connection.query(
                'SELECT BIN_TO_UUID( m.id ) AS id, m.title, m.year, m.director, m.duration, m.poster, m.rate, GROUP_CONCAT( g.name ORDER BY g.name ASC) AS genres ' +
	            'FROM movie_genres AS mg ' +
                'INNER JOIN movies AS m ON mg.movie_id = m.id ' +
                'INNER JOIN genres AS g ON mg.genre_id = g.id ' +
                'WHERE mg.genre_id = ? ' +
                'GROUP BY m.id, m.title, m.year, m.director, m.duration, m.poster, m.rate;', [ id ] 
            );

            return moviesGenre.map( movie => ({
                ...movie,
                genres: movie.genres ? movie.genres.split(',') : []
            }));
            
        }

        const [ movies ] = await connection.query(
            'SELECT BIN_TO_UUID( m.id ) AS id, m.title, m.year, m.director, m.duration, m.poster, m.rate, GROUP_CONCAT( g.name ORDER BY g.name ASC)  AS genres ' +
	        'FROM movie_genres AS mg ' +
            'LEFT JOIN movies AS m ON mg.movie_id = m.id ' +
            'LEFT JOIN genres AS g ON mg.genre_id = g.id ' +
            'GROUP BY m.id, m.title, m.year, m.director, m.duration, m.poster, m.rate;'
        );

        return movies.map( movie => ({
            ...movie,
            genres: movie.genres ? movie.genres.split(',') : []
        }));

    }

    static async getById ({ id }) {

        // Obtener una conexión desde el pool
        const conn = await connection.getConnection();

        try {
        // Iniciar una transacción
        await conn.query('START TRANSACTION');

        // Mostrar la información de la película que se busco con el id  
        const [ moviesId ] = await conn.query(
            'SELECT BIN_TO_UUID( m.id ) AS id, m.title, m.year, m.director, m.duration, m.poster, m.rate, GROUP_CONCAT( g.name ORDER BY g.name ASC) AS genres ' +
            'FROM movie_genres AS mg ' +
            'INNER JOIN movies AS m ON mg.movie_id = m.id ' +
            'INNER JOIN genres AS g ON mg.genre_id = g.id ' +
            'WHERE m.id = UUID_TO_BIN(?) ' +
            'GROUP BY m.id, m.title, m.year, m.director, m.duration, m.poster, m.rate;', [ id ]
        );

        if ( moviesId.length === 0 ) {
            // Revertir la transacción si no se mostro ninguna película
            await conn.query('ROLLBACK');
            return null; 
        }

        // Confirmar la transacción
        await conn.query('COMMIT')
        
        return moviesId.map( movie => ({
            ...movie,
            genres: movie.genres ? movie.genres.split(',') : []
        }))[0];

        } catch ( e ) {
            console.error('Error al ver la película ingresada:', e);
            
            // Revertir la transacción en caso de error
            await conn.query('ROLLBACK');
            throw new Error('Error al mostrar la película.');

        } finally {
            // Liberar la conexión de vuelta al pool
            conn.release();
        }
    }

    static async create ({ input }) {

        const {
            genre: genreInput, // genre is an arry
            title,
            year,
            duration,
            director,
            rate,
            poster,
        } = input;

        // Obtener una conexión desde el pool
        const conn = await connection.getConnection();

        try {
            // Generar un UUID para la nueva película
            const [ uuidResult ] = await conn.query('SELECT UUID() uuid;');
            const [{ uuid }] = uuidResult;

            // Iniciar una transacción
            await conn.query('START TRANSACTION');

            // Insertar la película en la tabla 'movies'
            await conn.query(
                'INSERT INTO movies (id, title, year, director, duration, poster, rate) ' +
                'VALUES (UUID_TO_BIN(?), ?, ?, ?, ?, ?, ?);',
                [ uuid, title, year, director, duration, poster, rate ]
            );



            // Insertar los generos asociados
            const genrePromises = genreInput.map( genre => {
                console.log('Inserting genre:', genre.toLowerCase(), 'with movie ID:', uuid);
                return conn.query(
                    'INSERT INTO movie_genres (movie_id, genre_id) ' +
                    'VALUES (UUID_TO_BIN(?), (SELECT id FROM genres WHERE LOWER(name) = ?));',
                    [ uuid, genre.toLowerCase()]
                ); 
            });

            await Promise.all( genrePromises );

            // Confirmar la transacción 
            await conn.query('COMMIT');

            // Obtener y devolver la película recien creada 
            const [movies] = await conn.query(
                'SELECT BIN_TO_UUID( m.id ) AS id, m.title, m.year, m.director, m.duration, m.poster, m.rate, GROUP_CONCAT( g.name ORDER BY g.name ASC) AS genres ' +
	            'FROM movie_genres AS mg ' +
                'INNER JOIN movies AS m ON mg.movie_id = m.id ' +
                'INNER JOIN genres AS g ON mg.genre_id = g.id ' +
                'WHERE m.id = UUID_TO_BIN(?) ' +
                'GROUP BY m.id, m.title, m.year, m.director, m.duration, m.poster, m.rate;', [uuid]
            );

            return movies.map( movie => ({
                ...movie,
                genres: movie.genres ? movie.genres.split(',') : []
            }))[0];

        } catch (error) {
            console.error('Error creating movie or associating genres:', error );
            
            // Revertir la transacción en caso de error 
            await conn.query('ROLLBACK')
            throw new Error('Error creating movie or associating genres');

        } finally {
            // Liberar la conexión de vuelta a la conecction
            conn.release();
        }

    }


    static async delete ({ id }) {

        // Obtener una conexión desde el pool
        const conn = await connection.getConnection();

        try {
            
            await conn.query('START TRANSACTION');

            // Eliminar los registros relacionados en la tabla movie_genres 
            const [ genresMovies ] = await conn.query(
                'DELETE FROM movie_genres WHERE movie_id = UUID_TO_BIN(?)', [ id ]
            );

            // Eliminar la película de la tabla movies
            const [ movieDeleted ] = await conn.query(
                'DELETE FROM movies WHERE id = UUID_TO_BIN(?)', [ id ]
            );
    
            if ( movieDeleted.affectedRows === 0 ) {

                await conn.query('ROLLBACK');
                return null;
            }      

            await conn.query('COMMIT');
            
            console.log(`Deleted ${ movieDeleted.affectedRows } movie(s) and ${ genresMovies.affectedRows } related genre(s).`);
    
            return movieDeleted;

        } catch ( e ) {
            console.error('Error deleting movie:', e);

            // Revertir la transacción en caso de error
            await conn.query('ROLLBACK');
            throw new Error('Error al eliminar la pelicula');
        
        } finally {

            // Liberar la conexión de vuelta al pool
            conn.release();
        } 

    }

    static async update ({ id, input }) {
        
        // Obtener una conexión desde el pool
        const conn = await connection.getConnection();

        const {
            genre: genreInput, // genre is an arry
            title,
            year,
            duration,
            director,
            rate,
            poster,
        } = input;

        // Asegurar que genreInput sea un array, si existe
        const genres = genreInput ? (Array.isArray(genreInput) ? genreInput : [genreInput]) : null;
        
        // Crear una lista de campos para actualizar
        const updateFields = [];
        const queryParams = [];

        // Agregar campos solo si estan presentes en la solicitud
        if ( title !== undefined ) {
            updateFields.push('title = ?');
            queryParams.push( title );
        }

        if ( year !== undefined ) {
            updateFields.push('year = ?');
            queryParams.push(year);
        }

        if ( duration !== undefined ) {
            updateFields.push('duration = ?');
            queryParams.push( duration );
        }

        if ( director !== undefined ) {
            updateFields.push('director = ?');
            queryParams.push( director );
        }

        if ( rate !== undefined ) {
            updateFields.push('rate = ?');
            queryParams.push( rate );
        }

        if ( poster !== undefined ) {
            updateFields.push('poster = ?');
            queryParams.push( poster );
        }

        queryParams.push( id );

        const updateQuery = `UPDATE movies SET ${updateFields.join(', ')} WHERE id = UUID_TO_BIN(?);`;

        try {

            // Iniciar una transacción
            await conn.query('START TRANSACTION');
            
            const [movieUpdate] = await conn.query( updateQuery, queryParams );


            if ( movieUpdate.affectedRows === 0 ) {
                // Revertir la transacción si no se actualizo la película 
                await conn.query('ROLLBACK');
                return null;
            }

            console.log('Genres input:', genres);

            if ( genres ) {
                 // Eliminar los géneros asociados a la película
                await conn.query(
                    'DELETE FROM movie_genres WHERE movie_id = UUID_TO_BIN(?);', [ id ]
                );

                // Insertar los nuevos géneros asociados a la pelicula
                const genrePromises = genres.map( genre => {
                    return conn.query(
                        'INSERT INTO movie_genres ( movie_id, genre_id) ' +
                        'VALUES ( UUID_TO_BIN( ? ), ( SELECT id FROM genres WHERE LOWER( name ) = ?));',
                        [ id, genre.toLowerCase() ]
                    );
                });

                await Promise.all( genrePromises );
            }
            
            // Confirmar la transacción
            await conn.query('COMMIT');

            console.log( movieUpdate );

            // Obtener y devolver la película actualizada con sus géneros
            const [ movies ] = await conn.query(
                'SELECT BIN_TO_UUID( m.id ) AS id, m.title, m.year, m.director, m.duration, m.poster, m.rate, GROUP_CONCAT( g.name ORDER BY g.name ASC) AS genres ' +
	            'FROM movie_genres AS mg ' +
                'INNER JOIN movies AS m ON mg.movie_id = m.id ' +
                'INNER JOIN genres AS g ON mg.genre_id = g.id ' +
                'WHERE m.id = UUID_TO_BIN(?) ' +
                'GROUP BY m.id, m.title, m.year, m.director, m.duration, m.poster, m.rate;', [ id ]
            );

    
            return movies.map( movie => ({
                ...movie,
                genres: movie.genres ? movie.genres.split(',') : []
            }))[0];

        } catch (error) {
            console.error('Error updating movie:', error);
            // Revertir la transacción en caso de error
            await conn.query('ROLLBACK');
            throw new Error('Error al actualizar la pelicula');
        } finally {
            // Liberar la conexion de vuelta al pool
            conn.release();
        }
 
    }

}