import { type Token } from "./types";

type PromiseBuilder<A, E = A> = {
    resolve: (value: A) => void;
    reject: (value: E) => void;
};

type RequestQueue = PromiseBuilder<Token | undefined, Error>[];

export class Queue {
    queue: RequestQueue = [];

    constructor(queue: RequestQueue = []) {
        this.queue = queue;
    }

    resolve = (token?: Token) => {
        this.queue.forEach(p => p.resolve(token));
        this.queue = [];
    };

    decline = (error: Error) => {
        this.queue.forEach(p => p.reject(error));
        this.queue = [];
    };
}
