export class TableAliasCache {
  private cache: Record<string, number> = {};

  public getAlias(tableName: string) {
    if (!this.cache[tableName]) {
      this.cache[tableName] = 0;
    }

    this.cache[tableName]++;

    return tableName + '_' + this.cache[tableName];
  }
}
