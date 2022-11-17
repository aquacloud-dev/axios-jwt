class MemoryStorage<T extends Record<string, string | null>>
  implements Storage
{
  constructor(private data: T = {} as T) {}

  get length(): number {
    return Object.keys(this.data).length;
  }

  clear(): void {
    this.data = {} as T;
  }

  key(index: number): string | null {
    return this.data?.[Object.keys(this.data)[index]] ?? null;
  }

  getItem(key: string): string | null {
    return this.data?.[key] ?? null;
  }

  setItem<K extends keyof T = keyof T>(key: K, value: any): void {
    const stringedValue: string =
      typeof value === "string" ? value : JSON.stringify(value);

    this.data[key] = stringedValue as T[K];
  }

  removeItem(key: string): void {
    delete this.data[key];
  }
}

export default MemoryStorage;
