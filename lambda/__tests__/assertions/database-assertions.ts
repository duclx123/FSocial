/**
 * Database Record Assertions
 * Common assertion patterns for database records
 */

export class DatabaseAssertions {
  // Existence Assertions
  static expectRecordExists(record: any) {
    expect(record).toBeDefined();
    expect(record).not.toBeNull();
  }

  static expectRecordNotExists(record: any) {
    expect(record).toBeUndefined();
  }

  // ID Assertions
  static expectValidId(record: any, idField = 'id') {
    this.expectRecordExists(record);
    expect(record).toHaveProperty(idField);
    expect(typeof record[idField]).toBe('string');
    expect(record[idField].length).toBeGreaterThan(0);
  }

  static expectValidUUID(record: any, idField = 'id') {
    this.expectValidId(record, idField);
    expect(record[idField]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  }

  // Timestamp Assertions
  static expectValidTimestamps(record: any, fields = ['created_at', 'updated_at']) {
    this.expectRecordExists(record);
    
    fields.forEach(field => {
      expect(record).toHaveProperty(field);
      expect(record[field]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(record[field]).getTime()).toBeGreaterThan(0);
    });
    
    if (fields.includes('created_at') && fields.includes('updated_at')) {
      const createdAt = new Date(record.created_at).getTime();
      const updatedAt = new Date(record.updated_at).getTime();
      expect(updatedAt).toBeGreaterThanOrEqual(createdAt);
    }
  }

  static expectCreatedRecently(record: any, maxAgeMs = 5000, field = 'created_at') {
    this.expectRecordExists(record);
    expect(record).toHaveProperty(field);
    
    const timestamp = new Date(record[field]).getTime();
    const now = Date.now();
    const age = now - timestamp;
    
    expect(age).toBeLessThan(maxAgeMs);
    expect(age).toBeGreaterThanOrEqual(0);
  }

  static expectUpdatedAfter(record: any, afterDate: Date | string) {
    this.expectRecordExists(record);
    expect(record).toHaveProperty('updated_at');
    
    const updatedAt = new Date(record.updated_at).getTime();
    const afterTime = typeof afterDate === 'string' ? new Date(afterDate).getTime() : afterDate.getTime();
    
    expect(updatedAt).toBeGreaterThan(afterTime);
  }

  // Field Value Assertions
  static expectFieldValue(record: any, field: string, expectedValue: any) {
    this.expectRecordExists(record);
    expect(record).toHaveProperty(field);
    expect(record[field]).toEqual(expectedValue);
  }

  static expectFieldNotNull(record: any, field: string) {
    this.expectRecordExists(record);
    expect(record).toHaveProperty(field);
    expect(record[field]).not.toBeNull();
    expect(record[field]).not.toBeUndefined();
  }

  static expectFieldNull(record: any, field: string) {
    this.expectRecordExists(record);
    if (record.hasOwnProperty(field)) {
      expect(record[field]).toBeNull();
    }
  }

  static expectFieldType(record: any, field: string, type: string) {
    this.expectRecordExists(record);
    expect(record).toHaveProperty(field);
    expect(typeof record[field]).toBe(type);
  }

  static expectFieldInRange(record: any, field: string, min: number, max: number) {
    this.expectRecordExists(record);
    expect(record).toHaveProperty(field);
    expect(typeof record[field]).toBe('number');
    expect(record[field]).toBeGreaterThanOrEqual(min);
    expect(record[field]).toBeLessThanOrEqual(max);
  }

  static expectFieldMatches(record: any, field: string, pattern: RegExp) {
    this.expectRecordExists(record);
    expect(record).toHaveProperty(field);
    expect(record[field]).toMatch(pattern);
  }

  // Array Field Assertions
  static expectArrayField(record: any, field: string, minLength?: number, maxLength?: number) {
    this.expectRecordExists(record);
    expect(record).toHaveProperty(field);
    expect(Array.isArray(record[field])).toBe(true);
    
    if (minLength !== undefined) {
      expect(record[field].length).toBeGreaterThanOrEqual(minLength);
    }
    
    if (maxLength !== undefined) {
      expect(record[field].length).toBeLessThanOrEqual(maxLength);
    }
  }

  static expectArrayContains(record: any, field: string, value: any) {
    this.expectArrayField(record, field);
    expect(record[field]).toContain(value);
  }

  static expectArrayNotEmpty(record: any, field: string) {
    this.expectArrayField(record, field, 1);
  }

  // Relationship Assertions
  static expectRelationship(record: any, foreignKeyField: string, relatedId: string) {
    this.expectRecordExists(record);
    expect(record).toHaveProperty(foreignKeyField);
    expect(record[foreignKeyField]).toBe(relatedId);
  }

  static expectBelongsTo(record: any, foreignKeyField: string) {
    this.expectRecordExists(record);
    expect(record).toHaveProperty(foreignKeyField);
    expect(typeof record[foreignKeyField]).toBe('string');
    expect(record[foreignKeyField].length).toBeGreaterThan(0);
  }

  // Status and Flag Assertions
  static expectStatus(record: any, expectedStatus: string, field = 'status') {
    this.expectFieldValue(record, field, expectedStatus);
  }

  static expectActive(record: any, field = 'is_active') {
    this.expectFieldValue(record, field, true);
  }

  static expectInactive(record: any, field = 'is_active') {
    this.expectFieldValue(record, field, false);
  }

  static expectDeleted(record: any, field = 'deleted_at') {
    this.expectRecordExists(record);
    expect(record).toHaveProperty(field);
    expect(record[field]).not.toBeNull();
  }

  static expectNotDeleted(record: any, field = 'deleted_at') {
    this.expectRecordExists(record);
    if (record.hasOwnProperty(field)) {
      expect(record[field]).toBeNull();
    }
  }

  // Comparison Assertions
  static expectRecordsEqual(record1: any, record2: any, ignoreFields: string[] = []) {
    this.expectRecordExists(record1);
    this.expectRecordExists(record2);
    
    const filtered1 = { ...record1 };
    const filtered2 = { ...record2 };
    
    ignoreFields.forEach(field => {
      delete filtered1[field];
      delete filtered2[field];
    });
    
    expect(filtered1).toEqual(filtered2);
  }

  static expectRecordsDifferent(record1: any, record2: any, field: string) {
    this.expectRecordExists(record1);
    this.expectRecordExists(record2);
    expect(record1[field]).not.toEqual(record2[field]);
  }

  // Collection Assertions
  static expectCollectionNotEmpty(records: any[]) {
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThan(0);
  }

  static expectCollectionSize(records: any[], expectedSize: number) {
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBe(expectedSize);
  }

  static expectCollectionContains(records: any[], predicate: (record: any) => boolean) {
    expect(Array.isArray(records)).toBe(true);
    const found = records.some(predicate);
    expect(found).toBe(true);
  }

  static expectAllRecordsMatch(records: any[], predicate: (record: any) => boolean) {
    expect(Array.isArray(records)).toBe(true);
    records.forEach(record => {
      expect(predicate(record)).toBe(true);
    });
  }

  static expectUniqueValues(records: any[], field: string) {
    expect(Array.isArray(records)).toBe(true);
    const values = records.map(r => r[field]);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  }

  static expectSortedBy(records: any[], field: string, order: 'asc' | 'desc' = 'asc') {
    expect(Array.isArray(records)).toBe(true);
    
    for (let i = 1; i < records.length; i++) {
      let prev = records[i - 1][field];
      let curr = records[i][field];
      
      // Convert to comparable values
      if (typeof prev === 'string' && prev.match(/^\d{4}-\d{2}-\d{2}/)) {
        prev = new Date(prev).getTime();
        curr = new Date(curr).getTime();
      }
      
      if (order === 'asc') {
        expect(curr).toBeGreaterThanOrEqual(prev);
      } else {
        expect(curr).toBeLessThanOrEqual(prev);
      }
    }
  }

  // Schema Validation
  static expectMatchesSchema(record: any, schema: Record<string, any>) {
    this.expectRecordExists(record);
    
    Object.entries(schema).forEach(([field, config]) => {
      if (config.required) {
        expect(record).toHaveProperty(field);
      }
      
      if (record.hasOwnProperty(field) && config.type) {
        expect(typeof record[field]).toBe(config.type);
      }
      
      if (record.hasOwnProperty(field) && config.pattern) {
        expect(record[field]).toMatch(config.pattern);
      }
    });
  }

  // User-specific Assertions
  static expectValidUser(user: any) {
    this.expectRecordExists(user);
    this.expectValidUUID(user, 'user_id');
    this.expectFieldNotNull(user, 'username');
    this.expectFieldNotNull(user, 'email');
    this.expectFieldMatches(user, 'email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    this.expectValidTimestamps(user);
  }

  // Post-specific Assertions
  static expectValidPost(post: any) {
    this.expectRecordExists(post);
    this.expectFieldNotNull(post, 'post_id');
    this.expectFieldNotNull(post, 'user_id');
    this.expectFieldNotNull(post, 'content');
    this.expectFieldMatches(post, 'visibility', /^(public|friends|private)$/);
    this.expectValidTimestamps(post);
  }

  // Recipe-specific Assertions
  static expectValidRecipe(recipe: any) {
    this.expectRecordExists(recipe);
    this.expectFieldNotNull(recipe, 'recipe_id');
    this.expectFieldNotNull(recipe, 'title');
    this.expectArrayNotEmpty(recipe, 'ingredients');
    this.expectArrayNotEmpty(recipe, 'instructions');
    this.expectValidTimestamps(recipe);
  }
}

// Convenience exports
export const expectRecordExists = (record: any) => DatabaseAssertions.expectRecordExists(record);
export const expectValidId = (record: any, idField?: string) => DatabaseAssertions.expectValidId(record, idField);
export const expectValidTimestamps = (record: any, fields?: string[]) => DatabaseAssertions.expectValidTimestamps(record, fields);
export const expectFieldValue = (record: any, field: string, value: any) => DatabaseAssertions.expectFieldValue(record, field, value);
export const expectCollectionNotEmpty = (records: any[]) => DatabaseAssertions.expectCollectionNotEmpty(records);
