type PromiseBuilder<A, E = A> = {
    resolve: (value: A) => void;
    reject: (value: E) => void;
};

type QueueItem<T> = PromiseBuilder<T, Error>;

export class Queue<T> {
    private queue: QueueItem<T>[] = [];

    constructor(queue: QueueItem<T>[] = []) {
        this.queue = queue;
    }

    enqueue = (item: QueueItem<T>) => this.queue.push(item);

    resolve = (value: T) => {
        this.queue.forEach(p => p.resolve(value));
        this.queue = [];
    };

    decline = (error: Error) => {
        this.queue.forEach(p => p.reject(error));
        this.queue = [];
    };
}
