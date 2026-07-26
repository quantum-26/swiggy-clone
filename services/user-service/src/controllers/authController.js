// HTTP concerns only

export class AuthController {
    constructor(authService) {
        this.authService = authService;
    }

    /*
        an arrow function assigned as a class field (not a regular method). 
        This matters because it auto-binds this to the class instance. 
        If you'd written a regular method and passed this.authController.signup directly to 
        app.post(...), calling it later as a bare function reference would lose its this context — 
    */
    signup = async(req, res, next) => {
        // every async route handler in Express needs try/catch, because Express doesn't automatically catch rejected promises from async functions
        try {
            const { email, password, name } = req.body;

            if(!email || !password || !name) {
                const error = new Error('email, password and name are required');
                error.statusCode = 400;
                throw error;
            }

            const user = await this.authService.signUp({ email, password, name });
            res.status(201).json({ user });
        }
        catch(err){
            next(err);
        }
    }

    login = async(req, res, next) => {
        try{
            const {email, password} = req.body;

            if(!email || !password){
                const error = new Error('email and password are required');
                error.statusCode = 400;
                throw error;
            }

            const {user, accessToken, refreshToken } = await this.authService.login({ email, password});

            res.cookie('refreshToken', refreshToken, {
                /*
                    makes the cookie completely inaccessible to JavaScript (document.cookie won't show it). 
                    This is the primary defense against XSS attacks stealing the refresh token — 
                    even if an attacker injects a malicious script into your page, they can't read this cookie. 
                */
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // in production this means the cookie is only ever sent over HTTPS.
                sameSite: 'strict', // the browser won't send this cookie on cross-site requests at all, prevent CSRF attack
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            /*
                the access token is designed to be read by your frontend JS and attached manually as an Authorization: Bearer <token> header on API calls
            */
            res.status(200).json({user, accessToken});
        }
        catch(err){
            next(err);
        }
    }

    refresh = async (req, res, next) => {
        try {
            const oldRefreshToken = req.cookies.refreshToken;

            if(!oldRefreshToken) {
                const error = new Error('No refresh token provided');
                error.statusCode = 401;
                throw error;
            }

            const {accessToken, refreshToken} = await this.authService.refresh(oldRefreshToken);

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure:  process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60* 1000,
            });

            res.status(200).json({ accessToken });
        }
        catch(err) {
            // On any refresh failure, proactively clear the cookie client-side
            // too — no point leaving a dead/stolen token sitting in the browser.
            res.clearCookie('refreshToken');
            next(err);
        }
    }

    logout = async (req, res, next) => {
        try{
            const refreshToken = req.cookies.refreshToken;

            if(refreshToken){
                await this.authService.logout(refreshToken);
            }

            res.clearCookie('refreshToken');
            res.status(204).send();
        }
        catch(err){
            next(err);
        }
    }
}