export function errorHandler(err, req, res, next) {
    console.log(err);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        error: {
            message: err.message || 'Internal server error'
        }
    })
}