import { marshall } from "@aws-sdk/util-dynamodb";
import { Match } from "./types"; 

type Entity = Match; 

export const generateItem = (entity: Entity) => {
  return {
    PutRequest: {
      Item: marshall(entity), 
    },
  };
};

export const generateBatch = (data: Entity[]) => {
  return data.map((e) => generateItem(e));
};
