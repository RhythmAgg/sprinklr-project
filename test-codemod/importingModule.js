import _difference from 'lodash/difference';
import _map from 'lodash/map';
import _values from 'lodash/values';

import plannerItemReader, {APPROVAL_STATUSES} from './targetModule'

import { STATUS } from '@sprinklrjs/modules/universalEntities/outbound/constants/status';
import { AccountEntity } from '@sprinklrjs/modules/universalEntities/account/entities';

import EMPTY_ARRAY from '@sprinklrjs/modules/infra/constants/emptyArray';
import EMPTY_OBJECT from '@sprinklrjs/modules/infra/constants/emptyObject';
import { THREADED_CONTENT } from '@sprinklrjs/modules/infra/constants/mediaTypes';

import {
  DRAFT_TYPE_MESSAGE,
  DRAFT_DELETED_MESSAGE,
  MSG_WITHOUT_ACCOUNT_ID,
  SENT_TYPE_MESSAGE,
  SENT_DELETED_MESSAGE,
  MSG_WITH_ACCOUNTS,
  EMBARGOED_MESSAGE,
  EMBARGOED_POST,
  PARENT_VARIANT_MESSAGE,
  PARENT_VARIANT_POST,
  TWITTER_THREAD_PLANNER_ITEM_WITH_ATTACHMENT,
  PLANNER_ITEM_WITH_ATTACHMENT,
  PLANNER_ITEM_WITH_TEXT_ENTITIES,
  PLANNER_ITEM_WITH_TWITTER_TEXT_ENTITIES,
  PLANNER_ITEM_WITH_TWITTER_THREAD_TEXT_ENTITIES,
  TWITTER_THREAD_PLANNER_ITEM_WITH_DESCRIPTION,
  PLANNER_ITEM_WITH_PERMA_LINK,
  MSG_WITH_ACCOUNT_NAME_AND_URL,
  MSG_WITH_MULTIPLE_ACCOUNTS,
  ACCOUNT_WITH_NAME_AND_URL,
  GROUPED_PLANNER_ITEM,
  PLANNER_ITEM_WITH_SET_AS_THUMBNAIL,
  PLANNER_ITEM_WITHOUT_SET_AS_THUMBNAIL,
} from '../__fixtures__/plannerItem.fixture';

describe('Outbound Messages - status', () => {
  it('should return SENT for sent message', () => {
    const status = plannerItemReader.status(SENT_TYPE_MESSAGE);
    expect(status).toEqual(STATUS.SENT);
  });

  it('should return DELETED for deleted sent message', () => {
    const status = plannerItemReader.status(SENT_DELETED_MESSAGE);
    expect(status).toEqual(STATUS.DELETED);
  });

  it('should return DRAFT for draft message', () => {
    const status = plannerItemReader.status(DRAFT_TYPE_MESSAGE);
    expect(status).toEqual(STATUS.DRAFT);
  });

  it('should return DRAFT for deleted draft message', () => {
    const status = plannerItemReader.status(DRAFT_DELETED_MESSAGE);
    expect(status).toEqual(STATUS.DRAFT);
  });
});

describe('Outbound Messages - isDeletedMessage', () => {
  it('should return FALSE for sent message', () => {
    const status = plannerItemReader.isDeletedMessage(SENT_TYPE_MESSAGE);
    expect(status).toEqual(false);
  });

  it('should return TRUE for deleted sent message', () => {
    const status = plannerItemReader.isDeletedMessage(SENT_DELETED_MESSAGE);
    expect(status).toEqual(true);
  });

  it('should return FALSE for draft message', () => {
    const status = plannerItemReader.isDeletedMessage(DRAFT_TYPE_MESSAGE);
    expect(status).toEqual(false);
  });

  it('should return FALSE for deleted draft message', () => {
    const status = plannerItemReader.isDeletedMessage(DRAFT_DELETED_MESSAGE);
    expect(status).toEqual(false);
  });
});

describe('Outbound Messages - isDraft', () => {
  it('should return FALSE for sent message', () => {
    const status = plannerItemReader.isDraft(SENT_TYPE_MESSAGE);
    expect(status).toEqual(false);
  });

  it('should return FALSE festor draft message', () => {
    const status = plannerItemReader.isDraft(DRAFT_TYPE_MESSAGE);
    expect(status).toEqual(true);
  });
});

describe('Accounts by channelSpecificContentList - accountsByChannelInfo', () => {
  it('should return all FBPAGE accounts', () => {
    const plannerItem = {
      details: {
        aIds: [2381],
        channelSpecificContentList: [
          {
            data: {},
            channelInfo: {
              channelType: 'FACEBOOK',
              accountType: 'FBPAGE',
            },
          },
        ],
        status: 'DRAFT',
      },
      _lookup: {
        ACCOUNT_ID: {
          2381: {
            accountId: 2381,
            accountType: 'FBPAGE',
            snType: 'FACEBOOK',
          },
          35249: {
            accountId: 35249,
            accountType: 'TWITTER',
            snType: 'TWITTER',
          },
        },
      },
    };
    const accounts = plannerItemReader.accountsByChannelInfo(plannerItem);
    expect(_map(accounts, AccountEntity.getId)).toEqual([2381]);
  });

  it('should return all FACEBOOK accounts', () => {
    const plannerItem = {
      details: {
        channelSpecificContentList: [
          {
            data: {},
            channelInfo: {
              channelType: 'FACEBOOK',
            },
          },
        ],
        status: 'DRAFT',
      },
      _lookup: {
        ACCOUNT_ID: {
          2381: {
            accountId: 2381,
            accountType: 'FBPAGE',
            snType: 'FACEBOOK',
          },
          35249: {
            accountId: 35249,
            accountType: 'TWITTER',
            snType: 'TWITTER',
          },
        },
      },
    };
    const accounts = plannerItemReader.accountsByChannelInfo(plannerItem);
    expect(_map(accounts, AccountEntity.getId)).toEqual([2381]);
  });
});

const getDummyMessageFromStatus = status => ({ details: { status } });

describe('testing isMessageInApprovalStatus', () => {
  const acceptableStatuses = Array.from(APPROVAL_STATUSES);
  test('should return true for all approval statuses', () => {
    acceptableStatuses.forEach(status => {
      expect(plannerItemReader.isInApprovalStatus(getDummyMessageFromStatus(status))).toBeTruthy();
    });
  });

  test('should return false for all other statuses', () => {
    const statusList = _values(STATUS);
    const unAcceptableStatuses = _difference(statusList, acceptableStatuses);

    unAcceptableStatuses.forEach(status => {
      expect(plannerItemReader.isInApprovalStatus(getDummyMessageFromStatus(status))).toBeFalsy();
    });
  });
});

describe('isDarkPost', () => {
  test('returns true for drafts, marked as dark post', () => {
    const darkDraftPlannerItem = {
      details: {
        status: 'DRAFT',
        channelSpecificAdditionalProperties: [
          {
            channelInfo: { channelType: 'FACEBOOK' },
            data: { IS_DARK_POST: ['true'] },
          },
        ],
      },
    };
    expect(plannerItemReader.isDarkPost(darkDraftPlannerItem)).toBeTruthy();
  });
  test('returns true for non-draft posts, marked as dark post', () => {
    const sentPlannerItem = {
      details: {
        status: 'SENT',
        isDarkPost: true,
      },
    };
    expect(plannerItemReader.isDarkPost(sentPlannerItem)).toBeTruthy();
  });
  test('returns false for drafts, not marked as dark post', () => {
    const draftPlannerItem = {
      details: {
        status: 'DRAFT',
        data: { IS_DARK_POST: ['false'] },
      },
    };
    expect(plannerItemReader.isDarkPost(draftPlannerItem)).toBeFalsy();
  });
  test('returns false for non-draft posts, not marked as dark post', () => {
    const sentPlannerItem = {
      details: {
        status: 'SENT',
      },
    };
    expect(plannerItemReader.isDarkPost(sentPlannerItem)).toBeFalsy();
  });
});

describe('Account reader', () => {
  test('should return empty if no account ids found in planner item', () => {
    expect(plannerItemReader.accounts(MSG_WITHOUT_ACCOUNT_ID)).toEqual(EMPTY_ARRAY);
  });
  test('should return empty object for accounts not found in lookup for account ids', () => {
    expect(plannerItemReader.accounts(DRAFT_TYPE_MESSAGE)).toEqual([EMPTY_OBJECT]);
  });
  test('should return only the accounts for the account ids of planner item', () => {
    const relevantAccounts = [MSG_WITH_ACCOUNTS._lookup.ACCOUNT_ID[78312], MSG_WITH_ACCOUNTS._lookup.ACCOUNT_ID[35249]];
    expect(plannerItemReader.accounts(MSG_WITH_ACCOUNTS)).toEqual(relevantAccounts);
  });
});

describe('Account Group reader', () => {
  test('should return empty if no account group ids found in planner item', () => {
    expect(plannerItemReader.accountGroups(MSG_WITHOUT_ACCOUNT_ID)).toEqual(EMPTY_ARRAY);
  });
  test('should return empty if account groups not found in lookup for account group ids', () => {
    expect(plannerItemReader.accountGroups(DRAFT_TYPE_MESSAGE)).toEqual([EMPTY_OBJECT]);
  });
  test('should return only the account groups for the account group ids of planner item', () => {
    const relevantAccountGroups = [
      MSG_WITH_ACCOUNTS._lookup.ACCOUNT_GROUP_ID[23542],
      MSG_WITH_ACCOUNTS._lookup.ACCOUNT_GROUP_ID[12313],
    ];
    expect(plannerItemReader.accountGroups(MSG_WITH_ACCOUNTS)).toEqual(relevantAccountGroups);
  });
});

describe('isEmbargoedMessage', () => {
  test('returns true if the MESSAGE is set confidential by its author', () => {
    expect(plannerItemReader.isEmbargoedMessage(EMBARGOED_MESSAGE)).toBe(true);
  });
  test('returns true if the POST is set confidential by its author', () => {
    expect(plannerItemReader.isEmbargoedMessage(EMBARGOED_POST)).toBe(true);
  });
  test('returns false if the MESSAGE was not sent confidential by its author', () => {
    expect(plannerItemReader.isEmbargoedMessage(DRAFT_TYPE_MESSAGE)).toBe(false);
  });
  test('returns false if the POST was not sent confidential by its author', () => {
    expect(plannerItemReader.isEmbargoedMessage(SENT_TYPE_MESSAGE)).toBe(false);
  });
});

describe('hasVariants', () => {
  test('returns true if the MESSAGE has variants', () => {
    expect(plannerItemReader.hasVariants(PARENT_VARIANT_MESSAGE)).toBe(true);
  });
  test('returns true if the POST has variants', () => {
    expect(plannerItemReader.hasVariants(PARENT_VARIANT_POST)).toBe(true);
  });
});

describe('variant count', () => {
  test('returns correct child variant count', () => {
    expect(plannerItemReader.childVariantCount(PARENT_VARIANT_MESSAGE)).toEqual(4);
  });
  test('returns correct child variant count', () => {
    expect(plannerItemReader.childVariantCount(PARENT_VARIANT_POST)).toEqual(4);
  });
});

describe('authId', () => {
  test('returns author id of the message', () => {
    const PLANNER_ITEM = { details: { authId: '1234' } };
    expect(plannerItemReader.authId(PLANNER_ITEM)).toEqual(PLANNER_ITEM.details.authId);
  });
});

describe('attachment', () => {
  test('should return attachmennt from content', () => {
    expect(plannerItemReader.attachment(PLANNER_ITEM_WITH_ATTACHMENT)).toEqual({
      previewImageUrl: 'https://a.jpg',
      type: 'PHOTO',
    });
  });
  test('should return attachmennt from first unpublished thread content', () => {
    expect(plannerItemReader.attachment(TWITTER_THREAD_PLANNER_ITEM_WITH_ATTACHMENT)).toEqual({
      previewImageUrl: 'https://a2.jpg',
      type: 'PHOTO',
    });
  });
  test('should return attachmennt from details', () => {
    expect(plannerItemReader.attachment({ details: { previewImageUrl: 'abc.jpg', attachmentType: 'PHOTO' } })).toEqual({
      previewImageUrl: 'abc.jpg',
      type: 'PHOTO',
    });
  });

  test('should return attachment with setAsThumbnail true if present', () => {
    expect(plannerItemReader.attachment(PLANNER_ITEM_WITH_SET_AS_THUMBNAIL)).toEqual({
      previewImageUrl: 'def',
      type: 'd',
    });
  });

  test('should return first attachment if no setAsThumbnail media present', () => {
    expect(plannerItemReader.attachment(PLANNER_ITEM_WITHOUT_SET_AS_THUMBNAIL)).toEqual({
      previewImageUrl: 'abc',
      type: 'a',
    });
  });
});

describe('textEntities', () => {
  test('should return planner item text entities when channel type is not twitter', () => {
    expect(plannerItemReader.textEntities(PLANNER_ITEM_WITH_TEXT_ENTITIES)).toEqual({ message: ['text'] });
  });
  test('should return planner item text entities when channel type is twitter and does not have thread list', () => {
    expect(plannerItemReader.textEntities(PLANNER_ITEM_WITH_TWITTER_TEXT_ENTITIES)).toEqual({
      message: ['twitter text'],
    });
  });
  test('should return planner item text entities when channel type is twitter and has thread list', () => {
    expect(plannerItemReader.textEntities(PLANNER_ITEM_WITH_TWITTER_THREAD_TEXT_ENTITIES)).toEqual({
      message: ['thread 2'],
    });
  });
});

describe('description', () => {
  test('should return plannerItem description if present', () => {
    expect(plannerItemReader.description({ description: 'abc' })).toEqual('abc');
  });
  test('should return message from first unpublished thread when twitter thread channel is present', () => {
    expect(plannerItemReader.description(TWITTER_THREAD_PLANNER_ITEM_WITH_DESCRIPTION)).toEqual('Plan Thread 2');
  });
});

describe('permaLink', () => {
  test('should return undefined if permaLink is not present', () => {
    expect(
      plannerItemReader.getPermaLink({
        details: {},
      })
    ).toEqual(undefined);
  });

  test('should return plannerItem permaLink if present', () => {
    expect(plannerItemReader.getPermaLink(PLANNER_ITEM_WITH_PERMA_LINK)).toEqual('link');
  });
});
describe('account name', () => {
  test('should return undefined for account Name if account not present', () => {
    expect(plannerItemReader.getAccountName(MSG_WITHOUT_ACCOUNT_ID)).toEqual(undefined);
  });

  test('should return account name if present', () => {
    expect(plannerItemReader.getAccountName(MSG_WITH_ACCOUNT_NAME_AND_URL)).toEqual('NAME');
  });
});

describe('account name from account', () => {
  test('should return undefined for account name if account not provided', () => {
    expect(plannerItemReader.getAccountNameFromAccount({}, MSG_WITHOUT_ACCOUNT_ID)).toEqual(undefined);
  });

  test('should return account Name if present', () => {
    expect(plannerItemReader.getAccountNameFromAccount(ACCOUNT_WITH_NAME_AND_URL, MSG_WITHOUT_ACCOUNT_ID)).toEqual(
      'NAME'
    );
  });
});

describe('account url', () => {
  test('should return undefined for account Url if account not present', () => {
    expect(plannerItemReader.getAccountUrl(MSG_WITHOUT_ACCOUNT_ID)).toEqual(undefined);
  });

  test('should return account url if present', () => {
    expect(plannerItemReader.getAccountUrl(MSG_WITH_ACCOUNT_NAME_AND_URL)).toEqual('URL');
  });
});

describe('account url from account', () => {
  test('should return undefined for account name if account not provided', () => {
    expect(plannerItemReader.getAccountUrlFromAccount({}, MSG_WITHOUT_ACCOUNT_ID)).toEqual(undefined);
  });

  test('should return account Name if present', () => {
    expect(plannerItemReader.getAccountUrlFromAccount(ACCOUNT_WITH_NAME_AND_URL, MSG_WITHOUT_ACCOUNT_ID)).toEqual(
      'URL'
    );
  });
});

describe('Account Type from account', () => {
  test('should return undefined for account type if account not provided', () => {
    expect(plannerItemReader.getAccountTypeFromAccount({}, MSG_WITHOUT_ACCOUNT_ID)).toEqual(undefined);
  });

  test('should return account type if present', () => {
    expect(plannerItemReader.getAccountTypeFromAccount(ACCOUNT_WITH_NAME_AND_URL, MSG_WITHOUT_ACCOUNT_ID)).toEqual(
      'FACEBOOK'
    );
  });
});

describe('All account names', () => {
  test('should return empty array for account Name if aids not present', () => {
    expect(plannerItemReader.getAllAccountNames(MSG_WITHOUT_ACCOUNT_ID)).toEqual([]);
  });

  test('should return account name if aids present', () => {
    expect(plannerItemReader.getAllAccountNames(MSG_WITH_MULTIPLE_ACCOUNTS)).toEqual(['NAME', 'ABC', 'DEF']);
  });
});

describe('All account urls', () => {
  test('should return empty array for account urls if aids not present', () => {
    expect(plannerItemReader.getAllAccountUrls(MSG_WITHOUT_ACCOUNT_ID)).toEqual([]);
  });

  test('should return account urls if aids present', () => {
    expect(plannerItemReader.getAllAccountUrls(MSG_WITH_MULTIPLE_ACCOUNTS)).toEqual(['URL1', 'URL2', 'URL3']);
  });
});

describe('getAllAccountTypes', () => {
  test('should return all account types', () => {
    expect(plannerItemReader.getAllAccountTypes(GROUPED_PLANNER_ITEM)).toEqual(['TWITTER', 'BLOG', 'NIKE']);
  });
});

describe('previewImageUrl', () => {
  test('should return previewImageUrl of first setAsThumbnail media if available', () => {
    expect(plannerItemReader.previewImageUrl(PLANNER_ITEM_WITH_SET_AS_THUMBNAIL)).toEqual('def');
  });
  test('should return previewImageUrl of first setAsThumbnail media if more than one present', () => {
    expect(plannerItemReader.previewImageUrl(PLANNER_ITEM_WITH_SET_AS_THUMBNAIL)).toEqual('def');
  });
  test('should return first image if no media with setAsThumbnail present', () => {
    expect(plannerItemReader.previewImageUrl(PLANNER_ITEM_WITHOUT_SET_AS_THUMBNAIL)).toEqual('abc');
  });
});

describe('attachmentType', () => {
  test('should return attachmentType of first setAsThumbnail media if available', () => {
    expect(plannerItemReader.attachmentType(PLANNER_ITEM_WITH_SET_AS_THUMBNAIL)).toEqual('d');
  });
  test('should return attachmentType of first setAsThumbnail media if more than one present', () => {
    expect(plannerItemReader.attachmentType(PLANNER_ITEM_WITH_SET_AS_THUMBNAIL)).toEqual('d');
  });
  test('should return first attachmentType if no media with setAsThumbnail present', () => {
    expect(plannerItemReader.attachmentType(PLANNER_ITEM_WITHOUT_SET_AS_THUMBNAIL)).toEqual('a');
  });
});

describe('getPostAssetId', () => {
  test('should return postAssetId from details', () => {
    expect(
      plannerItemReader.getPostAssetId({
        details: {
          postAssetId: '123',
        },
      })
    ).toEqual('123');
  });
});

describe('isCreativeOnlyPost', () => {
  test('should return isCreativeOnlyPost from details if not draft item', () => {
    expect(
      plannerItemReader.isCreativeOnlyPost({
        details: {
          isCreativeOnlyPost: true,
        },
      })
    ).toBeTruthy();
    expect(
      plannerItemReader.isCreativeOnlyPost({
        details: {
          isCreativeOnlyPost: false,
        },
      })
    ).toBeFalsy();
  });
});

describe('isCreatedInAcl', () => {
  test('should return true if postCreationSource is Creative Library', () => {
    expect(
      plannerItemReader.isCreatedInAcl({
        details: {
          postCreationSource: 'CREATIVE_LIBRARY',
        },
      })
    ).toBeTruthy();
  });
  test('should return false if creation source is not CL', () => {
    expect(
      plannerItemReader.isCreatedInAcl({
        details: {
          postCreationSource: 'FSP',
        },
      })
    ).toBeFalsy();
  });
});

describe('isAclPlannerItem', () => {
  test('should return true if is acl planner item', () => {
    expect(
      plannerItemReader.isAclPlannerItem({
        details: {
          isCreativeOnlyPost: true,
        },
      })
    ).toBeTruthy();
    expect(
      plannerItemReader.isAclPlannerItem({
        details: {
          isCreativeOnlyPost: false,
          postCreationSource: 'CREATIVE_LIBRARY',
        },
      })
    ).toBeTruthy();
  });

  test('should return false if is not acl planner item', () => {
    expect(
      plannerItemReader.isAclPlannerItem({
        details: {
          isCreativeOnlyPost: false,
          postCreationSource: 'FSP',
        },
      })
    ).toBeFalsy();
  });
});

describe('getMediaList', () => {
  test('should return mediaList from details content if planner item is post', () => {
    expect(
      plannerItemReader.getMediaList({
        documentType: 'POST',
        details: {
          content: {
            attachment: {
              mediaList: [
                {
                  previewImageUrl: '123',
                },
              ],
            },
          },
        },
      })
    ).toEqual([
      {
        previewImageUrl: '123',
      },
    ]);
  });
  test('should return mediaList content list if planner item is message', () => {
    expect(
      plannerItemReader.getMediaList({
        documentType: 'MESSAGE',
        details: {
          channelSpecificContentList: [
            {
              data: {
                attachment: {
                  mediaList: [
                    {
                      previewImageUrl: '123',
                    },
                  ],
                },
              },
            },
          ],
        },
      })
    ).toEqual([
      {
        previewImageUrl: '123',
      },
    ]);
  });
  test('should return THREADED_CONTENT mediaList from details content if planner item is post', () => {
    const DUMMY_MEDIA_DETAILS = [{ description: 'DESC' }];
    expect(
      plannerItemReader.getMediaList({
        documentType: 'POST',
        details: {
          content: {
            attachment: {
              type: THREADED_CONTENT,
              content: {
                threadList: [{ content: { attachment: { mediaList: DUMMY_MEDIA_DETAILS } } }],
              },
            },
          },
        },
      })
    ).toEqual(DUMMY_MEDIA_DETAILS);
  });
});

describe('isBoostRecommended', () => {
  test('should return true if boost recommended present in details', () => {
    expect(
      plannerItemReader.isBoostRecommended({
        details: {
          boostRecommended: true,
        },
      })
    ).toBeTruthy();
  });

  test('should return false if boost recommended present in details with value false', () => {
    expect(
      plannerItemReader.isBoostRecommended({
        details: {
          boostRecommended: false,
        },
      })
    ).toBeFalsy();
  });
});

describe('inboundMessageType', () => {
  test('should return inbound message type from additional', () => {
    expect(
      plannerItemReader.inboundMessageType({
        details: {
          additional: {
            INBOUND_MESSAGE_TYPE: ['393'],
          },
        },
        documentType: 'POST',
      })
    ).toEqual(['393']);
  });

  test('should return inbound message type from channelSpecific for message type', () => {
    expect(
      plannerItemReader.inboundMessageType({
        details: {
          channelSpecificAdditionalProperties: [
            {
              data: {
                INBOUND_MESSAGE_TYPE: ['123'],
              },
            },
          ],
        },
        documentType: 'MESSAGE',
      })
    ).toEqual(['123']);
  });
});

describe('isSponsored', () => {
  test('should return true if message has is sponsored field', () => {
    expect(
      plannerItemReader.isSponsored({
        details: {
          additional: {
            IS_SPONSORED: ['true'],
          },
        },
        documentType: 'POST',
      })
    ).toEqual('true');
  });

  test('should return false if message does not have is sponsored field', () => {
    expect(
      plannerItemReader.isSponsored({
        documentType: 'POST',
      })
    ).toEqual('false');
  });
});