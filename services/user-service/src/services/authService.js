// business logic, no HTTP, no SQL

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

/*
this is the bcrypt "cost factor." Each increment doubles the hashing time.
10 is a widely-used production default (roughly ~100ms per hash on typical hardware) 
— high enough to make brute-forcing expensive, low enough not to noticeably slow down your login endpoint
*/
const SAL_ROUNDS = 10;

export class AuthService {

    constructor(userRepository, jwtConfig) {

        /*
            The service never touches req/res — it takes plain objects in, returns plain objects out. 
            This is what makes it independent of Express; you could swap Express for Fastify later and this file wouldn't change at all.
        */
        this.userRepository = userRepository;
        this.jwtConfig = jwtConfig;
    }

    async signUp({ email, password, name }){
        const existing = await this.userRepository.findByEmail(email);

        if(existing){
            const error = new Error('Email already registerd');
            error.statusCode = 409; // 409 Conflict is the correct HTTP status for "resource already exists"
            throw error;
        }

        const passwordHash = await bcrypt.hash(password, SAL_ROUNDS);
        const user = await this.userRepository.create({ email, passwordHash, name });

        return user;
    }

    /*
        #generateTokens as a private method (the # prefix) — this is native JS private class field/method syntax (ES2022). 
        It signals this is internal implementation detail, not part of AuthService's public contract — callers should only ever call signup() and login().
    */
    #generateTokens(user){

        /*
            the access token is what gets sent on every API request (in the Authorization header), 
            so it's designed to expire fast — if stolen, the damage window is small.
        */
        const accessToken = jwt.sign(
            {sub: user.id, email: user.email}, // this is a JWT standard claim name meaning "who this token is about."
            this.jwtConfig.accessSecret,
            {expiresIn: '15m'}
        );

        /*
            The refresh token lives longer but is only ever sent to one endpoint (/refresh) to mint new access tokens, 
            and stored in an httpOnly cookie, never accessible to JS, which limits XSS exposure.
        */
        const refreshToken = jwt.sign(
            { sub: user.id, tokenType: 'refresh'},
            this.jwtConfig.refreshSecret,
            { expiresIn: '7d'}
        )

        return { accessToken, refreshToken };
    }

    async login({ email, password }) {
        const user = await this.userRepository.findByEmail(email);

        if(!user){
            const error = new Error('Invalid email or password');
            error.statusCode = 401;
            throw error;
        }

        /*
            never manually re-hash and compare strings —
            bcrypt's compare function handles extracting the salt from the stored hash and does a timing-safe comparison internally. 
            Never write bcrypt.hash(password) === user.password_hash yourself — that would generate a new salt and never match.
        */
        const isValid = await bcrypt.compare(password, user.password_hash);

        if(!isValid) {
            const error = new Error('Invalid email or password');
            error.statusCode = 401;
            throw error;
        }

        const tokens = this.#generateTokens(user);
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            ...tokens
        }
    }
}