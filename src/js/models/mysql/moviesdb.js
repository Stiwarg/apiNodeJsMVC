import mysql from 'mysql2/promise';

const config = {
    host: 'localhost',
    user: 'root',
    port: 3307,
    password: '123456789',
    database: 'moviesdb'
}

const connection = await mysql.createConnection( config );

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
                'SELECT BIN_TO_UUID( m.id ) AS id, title, year, director, duration, poster, rate, g.name AS genre '+
                    'FROM movie_genres AS mg ' +
                    'INNER JOIN movies AS m ON mg.movie_id = m.id ' +
                    'INNER JOIN genres AS g ON mg.genre_id = g.id ' +
                    'WHERE mg.genre_id = ?;', [ id ] 
            );

            return moviesGenre;
            
        }

        const [ movies ] = await connection.query(
            'SELECT BIN_TO_UUID(id) AS id, title, year, director, duration, poster, rate  FROM movies;'
        );

        return movies;

    }

    static async getById ({ id }) {

        const [ moviesId ] = await connection.query(
            'SELECT BIN_TO_UUID(id) AS id, title, year, director, duration, poster, rate FROM movies '+
            ' WHERE id = UUID_TO_BIN(?);',[id]
        );

        if ( moviesId.length === 0 ) return null;
        
        return moviesId[0];
        
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

        const [ uuidResult ] = await connection.query('SELECT UUID() uuid;');
        const [{ uuid }] = uuidResult;

        try {

            await connection.query(
                `INSERT INTO movies (id, title, year, director, duration, poster, rate)
                    VALUES (UUID_TO_BIN("${ uuid }"), ?, ?, ?, ?, ?, ?);`,
                [title, year, director, duration, poster, rate]
            );
            
        } catch ( e ) {
            throw new Error('Error creating movie');
        }

        const [ movies ] = await connection.query(
            'SELECT BIN_TO_UUID(id) AS id, title, year, director, duration, poster, rate ' +
                'FROM movies WHERE id = UUID_TO_BIN(?);', [ uuid ] 
        );

        return movies[0];
    }

    static async delete ({ id }) {

        try {
            
            const [ movieDeleted ] = await connection.query(
                'DELETE FROM movies WHERE id = UUID_TO_BIN(?)', [ id ]
            );
    
            if ( movieDeleted.affectedRows === 0 ) return null;        
            
            console.log(`Deleted ${ movieDeleted.affectedRows } row(s).`);
    
            return movieDeleted;

        } catch ( e ) {
            console.error('Error deleting movie:', e);

            throw new Error('Error al eliminar la pelicula');
        }

    }

    static async update ({ id, input }) {

        const {
            genre: genreInput, // genre is an arry
            title,
            year,
            duration,
            director,
            rate,
            poster,
        } = input;

        try {
            
            const [ movieUpdate ] = await connection.query(
                'UPDATE movies ' +
                'SET ? ' +
                'WHERE id = UUID_TO_BIN(?);',[ input, id] 
            );

            if ( movieUpdate.affectedRows === 0 ) return null;
            
            console.log( movieUpdate );

            const [ movies ] = await connection.query(
                'SELECT BIN_TO_UUID(id) AS id, title, year, director, duration, poster, rate ' +
                    'FROM movies WHERE id = UUID_TO_BIN(?);', [ id ] 
            );
    
    
            return movies;

        } catch (error) {
            console.error('Error updating movie:', error);
            throw new Error('Error al actualizar la pelicula');
        }
 
    }

}