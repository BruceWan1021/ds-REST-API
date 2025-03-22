export function generateBatch(items: any[]) {
    return items.map((item) => ({
      PutRequest: {
        Item: item,
      },
    }));
  }