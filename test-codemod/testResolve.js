import _difference from 'lodash/difference';
import _map from 'lodash/map';
import _values from 'lodash/values';

import isDeletedMessage from "./targetModule/isDeletedMessage";
import { APPROVAL_STATUSES } from "./targetModule/APPROVAL_STATUSES";

describe('Outbound Messages - isDeletedMessage', () => {
    it('should return FALSE for sent message', () => {
      const status = isDeletedMessage(SENT_TYPE_MESSAGE);
      expect(status).toEqual(false);
    });
  
    it('should return TRUE for deleted sent message', () => {
      const status = isDeletedMessage(SENT_DELETED_MESSAGE);
      expect(status).toEqual(true);
    });
  
    it('should return FALSE for draft message', () => {
      const status = isDeletedMessage(DRAFT_TYPE_MESSAGE);
      expect(status).toEqual(false);
    });
  
    it('should return FALSE for deleted draft message', () => {
      const status = isDeletedMessage(DRAFT_DELETED_MESSAGE);
      expect(status).toEqual(false);
    });
  });
