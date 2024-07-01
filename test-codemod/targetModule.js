import { compose } from 'recompose';

import _castArray from 'lodash/castArray';
import _compact from 'lodash/compact';
import _isEmpty from 'lodash/isEmpty';
import _every from 'lodash/every';
import _filter from 'lodash/filter';
import _get from 'lodash/get';
import _head from 'lodash/head';
import _keys from 'lodash/keys';
import _map from 'lodash/map';
import _property from 'lodash/property';
import _reduce from 'lodash/reduce';
import _size from 'lodash/size';
import _find from 'lodash/find';

import snTypes from '@sprinklrjs/modules/infra/constants/snTypes';
import { isNotEmpty } from '@sprinklrjs/modules/infra/utils/isNotEmpty';
import contentTypes from 'core/constants/contentTypes';

import { AccountEntity } from '@sprinklrjs/modules/universalEntities/account/entities';
import { STATUS } from '@sprinklrjs/modules/universalEntities/outbound/constants/status';
import EMPTY_OBJECT_READONLY from '@sprinklrjs/modules/infra/constants/emptyObject';
import EMPTY_ARRAY_READONLY from '@sprinklrjs/modules/infra/constants/emptyArray';
import { CHANNEL_TYPES } from '@sprinklrjs/modules/infra/constants/channelTypes';
import ASSET_CLASSES from '@sprinklrjs/modules/infra/constants/assetClasses';
import AssetClassLabelManager from 'containers/connectors/connectAssetClassLabelManager/AssetClassLabelManager';
import { THREADED_CONTENT } from '@sprinklrjs/modules/infra/constants/mediaTypes';

const NIKE = snTypes.NIKE.type;

export const APPROVAL_STATUSES = new Set([STATUS.APPROVAL, STATUS.REJECTED, STATUS.REJECTED_BY_RULE]);

const filterAccountOnAccountType = accountType => account => AccountEntity.getAccountType(account) === accountType,
  filterAccountOnSnType = snType => account => AccountEntity.getSnType(account) === snType;

const _extractAccountType = _property('accountType');
const _extractAttachment = _property('data.attachment.mediaList');
const _extractChannelType = _property('channelType');
const _extractTemplateAttachment = _property('data.templateAttachment.mediaList');
const channelSpecificContentList = _property('details.channelSpecificContentList');
const channelSpecificAdditionalProperties = _property('details.channelSpecificAdditionalProperties');

const findFirstUnpublishedThread = content =>
  _find(content?.data?.attachment?.content?.threadList, thread => !thread?.published);

const _extractUnpublishedThreadAttachment = content =>
  findFirstUnpublishedThread(content)?.content?.attachment?.mediaList;

function getAttachmentsFromContentList(plannerItem, channelInfo) {
  const contentList = channelSpecificContentList(plannerItem);

  if (channelInfo) {
    const content = _filter(
      contentList,
      ({ channelInfo: contentChannelInfo, data }) => channelInfo?.channelType === contentChannelInfo?.channelType
    )?.[0];
    return (
      _extractAttachment(content) || _extractUnpublishedThreadAttachment(content) || _extractTemplateAttachment(content)
    );
  }

  return _compact(
    _map(
      contentList,
      content =>
        _extractAttachment(content) ||
        _extractUnpublishedThreadAttachment(content) ||
        _extractTemplateAttachment(content)
    )
  );
}

const checkForDeleted = plannerItem => _get(plannerItem, 'details.deleted');
const contentType = _property('details.contentType');
const contentTemplateId = _property('details.contentTemplateId');
const date = _property('date');
const documentType = _property('documentType');
const getFirstAttachmentFromItem = compose(_head, getAttachmentsFromContentList);
const id = _property('id');
const mId = _property('details.mId');
const mType = _property('details.mType');
const postAId = _property('details.aIds[0]');
const title = _property('title');
const taxonomy = _property('details.taxonomy');
const clientCustomProperties = _property('details.taxonomy.clientCustomProperties');
const partnerCustomProperties = _property('details.taxonomy.partnerCustomProperties');
const deleted = checkForDeleted;
const authId = _property('details.authId');

/**
 * Returns true if content list belongs to given channe
 * lInfo.
 * @param property
 * @returns {boolean}
 */
const hasChannelInfo = function (property) {
  return _every(_castArray(_get(property, 'channelInfo')), this);
};

/**
 * Returns channelSpecificItem ( from channelSpecificContentList / channelSpecificAdditionalProperties ) of given templateId and channelType.
 * @param list : channelSpecificContentList / channelSpecificAdditionalProperties
 * @param params
 */
const channelSpecificEntity = (list, params = EMPTY_OBJECT_READONLY) => list.find(hasChannelInfo, params);

const channelSpecificAdditionalProperty = (message, params) => {
  const additionalProperties = channelSpecificAdditionalProperties(message);

  return _isEmpty(additionalProperties) ? EMPTY_OBJECT_READONLY : channelSpecificEntity(additionalProperties, params);
};

/**
 * Returns channelSpecificContent of given templateId and channelType.
 * @param message
 * @param
 * @returns channelSpecificContent}
 */
const channelSpecificContent = (message, channelInfo = EMPTY_OBJECT_READONLY) => {
  const contentList = channelSpecificContentList(message);
  return (contentList && channelSpecificEntity(contentList, channelInfo)) || _head(contentList);
};

const accountsFromLookup = plannerItem => _get(plannerItem, '_lookup.ACCOUNT_ID', EMPTY_OBJECT_READONLY);

const accountGroupsFromLookup = plannerItem => _get(plannerItem, '_lookup.ACCOUNT_GROUP_ID', EMPTY_OBJECT_READONLY);

const getAccount = plannerItem => accountId => accountsFromLookup(plannerItem)[accountId] || EMPTY_OBJECT_READONLY;

const getAccountGroup = plannerItem => accountGroupId =>
  accountGroupsFromLookup(plannerItem)[accountGroupId] || EMPTY_OBJECT_READONLY;

const accountIds = plannerItem => _get(plannerItem, 'details.aIds');

const accounts = plannerItem => _map(accountIds(plannerItem), getAccount(plannerItem));

const accountGroupIds = plannerItem => _get(plannerItem, 'details.aGIds');

const accountGroups = plannerItem => _map(accountGroupIds(plannerItem), getAccountGroup(plannerItem));

const cTs = plannerItem => _get(plannerItem, 'details.cTs');

const getChannelTypesFromAccounts = accountList => accountList.map(account => _get(account, 'snType')),
  getAccountTypesFromAccounts = accountList =>
    accountList.map(account => AccountEntity.getAccountType(account) || AccountEntity.getSnType(account));

const channels = plannerItem => {
  const accountsList = accounts(plannerItem),
    channelList = cTs(plannerItem);

  return channelList || getChannelTypesFromAccounts(accountsList);
};

const accountsByChannelType = plannerItem => {
  const channelAssociated = cTs(plannerItem)?.[0];
  const accountsList = accounts(plannerItem);
  return _filter(accountsList, account => AccountEntity.getSnType(account) === channelAssociated);
};

const getAccountName = plannerItem => {
  const account = getAccount(plannerItem)(_get(accountIds(plannerItem), 0));
  const groupName = getAccountGroup(plannerItem)(_get(accountGroupIds(plannerItem), 0))?.groupName;

  return AccountEntity.getDisplayName(account) || groupName || AccountEntity.getAccountType(account);
};

const getAccountUrl = plannerItem => {
  const account = getAccount(plannerItem)(_get(accountIds(plannerItem), 0));
  return AccountEntity.getProfileImageUrl(account);
};

const getAllAccountNames = plannerItem =>
  accountIds(plannerItem)?.map(accountId => {
    const account = getAccount(plannerItem)(accountId);
    return AccountEntity.getDisplayName(account) || AccountEntity.getAccountType(account);
  }) || EMPTY_ARRAY_READONLY;

const getAllAccountUrls = plannerItem =>
  accountIds(plannerItem)?.map(accountId => {
    const account = getAccount(plannerItem)(accountId);
    return AccountEntity.getProfileImageUrl(account);
  }) || EMPTY_ARRAY_READONLY;

const channel = plannerItem => _get(channels(plannerItem), '0'),
  isPost = plannerItem => documentType(plannerItem) === 'POST',
  isChannelType = (plannerItem, ch) => !!ch && channel(plannerItem) === (snTypes[ch] || EMPTY_OBJECT_READONLY).type,
  templateId = plannerItem =>
    contentTemplateId(plannerItem) || _get(channelSpecificContent(plannerItem), 'channelInfo.templateId');

const getAllChannels = plannerItem => {
  const groupedContent = plannerItem.groupedContent;
  return groupedContent.map(variant => channel(variant));
};

function channelsInfo(plannerItem) {
  return isPost(plannerItem)
    ? [
        {
          channelType: channel(plannerItem),
          templateId: templateId(plannerItem),
        },
      ]
    : _map(channelSpecificContentList(plannerItem), 'channelInfo');
}

function accountTypesForPosts(plannerItem) {
  const accountsList = accounts(plannerItem),
    channelList = cTs(plannerItem);

  return isNotEmpty(accountsList) ? getAccountTypesFromAccounts(accountsList) : channelList;
}

function accountTypesForMessages(plannerItem) {
  return _map(
    channelsInfo(plannerItem),
    channelInfo => _extractAccountType(channelInfo) || _extractChannelType(channelInfo)
  );
}

const getFirstAttachmentWithSetAsThumbnailTrue = (plannerItem, channelInfo) => {
  if (channelInfo) {
    const attachments = getAttachmentsFromContentList(plannerItem, channelInfo) || EMPTY_ARRAY_READONLY;
    return _find(attachments, attachment => attachment.setAsThumbnail);
  }
  const attachments = getFirstAttachmentFromItem(plannerItem) || EMPTY_ARRAY_READONLY;
  return _find(attachments, attachment => attachment.setAsThumbnail);
};

function previewImageUrl(plannerItem, channelInfo) {
  const firstAttachmentWithSetAsThumbnailTrue = getFirstAttachmentWithSetAsThumbnailTrue(plannerItem, channelInfo);
  if (firstAttachmentWithSetAsThumbnailTrue) {
    return firstAttachmentWithSetAsThumbnailTrue.previewImageUrl;
  }
  if (channelInfo) {
    const attachments = getAttachmentsFromContentList(plannerItem, channelInfo) || EMPTY_ARRAY_READONLY;
    return attachments?.[0]?.previewImageUrl;
  }
  return (
    _get(getFirstAttachmentFromItem(plannerItem), '0.previewImageUrl') || _get(plannerItem, 'details.previewImageUrl')
  );
}

function attachmentType(plannerItem, channelInfo) {
  const firstAttachmentWithSetAsThumbnailTrue = getFirstAttachmentWithSetAsThumbnailTrue(plannerItem, channelInfo);
  if (firstAttachmentWithSetAsThumbnailTrue) {
    return firstAttachmentWithSetAsThumbnailTrue?.type;
  }
  if (channelInfo) {
    const attachments = getAttachmentsFromContentList(plannerItem, channelInfo) || EMPTY_ARRAY_READONLY;
    return attachments?.[0]?.type;
  }
  return _get(getFirstAttachmentFromItem(plannerItem), '0.type') || _get(plannerItem, 'details.attachmentType');
}

function hasAttachment(plannerItem, channelInfo) {
  return !!(previewImageUrl(plannerItem, channelInfo) || attachmentType(plannerItem, channelInfo));
}

function getSourceLanguage(plannerItem) {
  return _get(plannerItem, '_lookup.sourceLanguage');
}

const getPermaLink = plannerItem => plannerItem?.details?.permalink;

/**
 * Returns message to be shown for given universal message. For NIKE posts, return title if description is not present.
 * @param plannerItem
 * @returns {string}
 */
const description = function (plannerItem) {
  let msg = plannerItem.description;

  if (!msg) {
    if (isChannelType(plannerItem, snTypes.TWITTER.type)) {
      const content = channelSpecificContent(plannerItem);
      const threadContentMessage = findFirstUnpublishedThread(content)?.content?.message;
      msg = threadContentMessage || msg;
    }
  }
  return msg || '';
};

const isOutboundItem = function (plannerItem) {
  const docType = _get(plannerItem, 'documentType');
  return docType === 'POST' || docType === 'MESSAGE';
};

const attachment = function (plannerItem, channelInfo) {
  const firstAttachmentWithSetAsThumbnailTrue = getFirstAttachmentWithSetAsThumbnailTrue(plannerItem, channelInfo);
  if (firstAttachmentWithSetAsThumbnailTrue) {
    return {
      previewImageUrl: firstAttachmentWithSetAsThumbnailTrue.previewImageUrl,
      type: firstAttachmentWithSetAsThumbnailTrue.type,
    };
  }
  return hasAttachment(plannerItem, channelInfo)
    ? {
        previewImageUrl: previewImageUrl(plannerItem, channelInfo),
        type: attachmentType(plannerItem, channelInfo),
      }
    : {};
};

const getPostAssetId = plannerItem => {
  const { details = EMPTY_OBJECT_READONLY } = plannerItem;
  return details.postAssetId;
};

function status(plannerItem) {
  const isDeleted = checkForDeleted(plannerItem),
    plannerItemStatus = _get(plannerItem, 'details.status');

  return isDeleted && plannerItemStatus === STATUS.SENT ? STATUS.DELETED : plannerItemStatus;
}

function translationResponse(plannerItem) {
  return _get(plannerItem, '_lookup.translationResponse');
}

function isDraft(plannerItem) {
  return status(plannerItem) === STATUS.DRAFT;
}

function getAdditional(plannerItem) {
  if (isPost(plannerItem)) {
    return plannerItem?.details?.additional;
  }

  return channelSpecificAdditionalProperties(plannerItem)?.[0]?.data;
}

const getMediaList = (plannerItem, channelInfo) => {
  if (isPost(plannerItem)) {
    const { details } = plannerItem;
    if (details?.content?.attachment?.type === THREADED_CONTENT) {
      return (
        details.content.attachment.content?.threadList?.[0]?.content?.attachment?.mediaList || EMPTY_ARRAY_READONLY
      );
    }

    return details?.content?.attachment?.mediaList || EMPTY_ARRAY_READONLY;
  }

  if (channelInfo) {
    const attachments = getAttachmentsFromContentList(plannerItem, channelInfo);
    return attachments || EMPTY_ARRAY_READONLY;
  }
  return getFirstAttachmentFromItem(plannerItem);
};

const getAccountNameFromAccount = (account, plannerItem) => {
  const groupName = getAccountGroup(plannerItem)(_get(accountGroupIds(plannerItem), 0))?.groupName;
  return AccountEntity.getDisplayName(account) || groupName || AccountEntity.getAccountType(account);
};

const getAccountUrlFromAccount = account => AccountEntity.getProfileImageUrl(account);

const getAccountTypeFromAccount = account => AccountEntity.getAccountType(account);

const isBoostRecommended = plannerItem => _get(plannerItem, 'details.boostRecommended');

/**
 * Returns true if the message has been marked as confidential by the author of the message
 * @param plannerItem
 * @returns {boolean}
 */
function isEmbargoedMessage(plannerItem) {
  if (isPost(plannerItem)) {
    return _get(plannerItem, 'details.additional.EMBARGOED.0') === 'true';
  }
  const additionalProperty =
    channelSpecificAdditionalProperty(plannerItem, { channelType: CHANNEL_TYPES.OUTBOUND }) || EMPTY_OBJECT_READONLY;
  return _get(additionalProperty, 'data.EMBARGOED.0') === 'true';
}

function textEntities(plannerItem) {
  if (isChannelType(plannerItem, snTypes.TWITTER.type)) {
    const content = channelSpecificContent(plannerItem);
    const threadContentTextEntities = findFirstUnpublishedThread(content)?.content?.textEntities;

    if (threadContentTextEntities) {
      return threadContentTextEntities;
    }
  }

  return plannerItem?.textEntities;
}

function isFavorited(plannerItem) {
  return plannerItem?.details?.favoritedForCurrentUser ?? false;
}

function isLocked(plannerItem) {
  return plannerItem?.details?.locked ?? false;
}

function getAllAccountTypes(plannerItem) {
  const groupedContent = plannerItem.groupedContent;
  return groupedContent.map(variant => _get(accountTypesForMessages(variant), '0'));
}

function isSponsored(plannerItem) {
  return plannerItem?.details?.additional?.IS_SPONSORED?.[0] ?? 'false';
}

const READER = {
  isPost,
  documentType,
  contentType,
  getPostAssetId,
  contentTemplateId,
  mId,
  mType,
  date,
  postAId,
  description,
  channelSpecificContentList,
  channelSpecificAdditionalProperties,
  channelsInfo,
  snTypes: channels,
  snType: channel,
  isChannelType,
  id,
  isBoostRecommended,
  getMediaList,
  aIds: accountIds,
  aGIds: accountGroupIds,
  accounts,
  accountGroups,
  title,
  taxonomy,
  isOutboundItem,
  previewImageUrl,
  attachmentType,
  hasAttachment,
  attachment,
  getSourceLanguage,
  deleted,
  status,
  templateId,
  translationResponse,
  textEntities,
  getPermaLink,
  getAccountName,
  getAccountUrl,
  getAllChannels,
  getAllAccountNames,
  getAllAccountUrls,
  getAllAccountTypes,
  accountsByChannelType,
  getAccountNameFromAccount,
  getAccountUrlFromAccount,
  getAccountTypeFromAccount,
  isFavorited,
  isLocked,
  isSponsored,

  urlEntities(plannerItem) {
    return plannerItem?.details?.urlEntities;
  },

  accountType(plannerItem) {
    return _head(READER.accountTypes(plannerItem));
  },

  accountTypes(plannerItem) {
    return isDraft(plannerItem) ? accountTypesForMessages(plannerItem) : accountTypesForPosts(plannerItem);
  },

  accountsByChannelInfo(plannerItem) {
    if (isDraft(plannerItem)) {
      const channelsInfoList = channelsInfo(plannerItem),
        accountsList = Object.values(accountsFromLookup(plannerItem));

      return _reduce(
        channelsInfoList,
        (acc, channelInfo) => {
          const accountType = _extractAccountType(channelInfo),
            snType = _extractChannelType(channelInfo);

          acc.push(
            ..._filter(
              accountsList,
              accountType ? filterAccountOnAccountType(accountType) : filterAccountOnSnType(snType)
            )
          );

          return acc;
        },
        []
      );
    }
    return accounts(plannerItem);
  },

  clientCustomProperties,

  partnerCustomProperties,

  customProperties(plannerItem) {
    return { ...clientCustomProperties(plannerItem), ...partnerCustomProperties(plannerItem) };
  },

  personaId(plannerItem) {
    return _get(getAdditional(plannerItem), 'PERSONA_ID');
  },

  themeId(plannerItem) {
    return _get(getAdditional(plannerItem), 'THEME_ID');
  },

  customerJourneyId(plannerItem) {
    return _get(getAdditional(plannerItem), 'CUSTOMER_JOURNEY_ID');
  },

  inboundMessageType(plannerItem) {
    return _get(getAdditional(plannerItem), 'INBOUND_MESSAGE_TYPE');
  },

  isPublishedAsDraft(plannerItem) {
    return getAdditional(plannerItem)?.IS_PUBLISHED_AS_DRAFT?.[0];
  },

  getMediaErasedMessage(plannerItem) {
    return getAdditional(plannerItem)?.PII_COMPLIANCE_MEDIA_ERASED_MSG?.[0];
  },

  subCampaignId(plannerItem) {
    return _get(taxonomy(plannerItem), 'subCampaignId');
  },

  campaignId(plannerItem) {
    return _get(taxonomy(plannerItem), 'campaignId');
  },

  campaign(plannerItem) {
    const campaignId = READER.campaignId(plannerItem);
    return _get(plannerItem, `_lookup.CAMPAIGN_ID.${campaignId}`);
  },

  groupedContent(plannerItem) {
    return plannerItem?.groupedContent;
  },

  groupKey(plannerItem) {
    return plannerItem.groupKey;
  },

  isContentGrouped(plannerItem) {
    return plannerItem?.isContentGrouped;
  },

  sourceLocale(plannerItem) {
    return _get(plannerItem, 'details.locale');
  },

  color(plannerItem) {
    return _get(plannerItem, 'details.color');
  },

  isDraft,

  isDeletedMessage(plannerItem) {
    return status(plannerItem) === STATUS.DELETED;
  },

  tags(plannerItem) {
    return _get(taxonomy(plannerItem), 'tags');
  },

  targeting(plannerItem) {
    return _get(plannerItem, 'details.targeting');
  },

  targetLocales(plannerItem) {
    const languages = _reduce(
      translationResponse(plannerItem),
      (acc, templateTranslation) => Object.assign(acc, templateTranslation),
      {}
    );
    return _keys(languages);
  },

  templateName(plannerItem, channelInfo) {
    const content = channelSpecificContent(plannerItem, channelInfo);
    return (
      _get(plannerItem, 'details.contentTemplateName') ||
      _get(content, 'data.additional.CONTENT_TEMPLATE_NAME.0') ||
      contentTypes[contentType(plannerItem)] ||
      AssetClassLabelManager.getCapitalizedSingularLabel(ASSET_CLASSES.OUTBOUND_MESSAGE)
    );
  },

  translationTriggered(plannerItem) {
    return _get(plannerItem, 'details.translationTriggered');
  },

  version(plannerItem) {
    return _get(plannerItem, 'details.version', plannerItem.version);
  },

  isShellMessage(plannerItem) {
    return _get(plannerItem, 'details.shellMessage');
  },

  isMessageChildVariant(plannerItem) {
    return _get(plannerItem, 'details.localizedCopy');
  },

  sourceMessageId(plannerItem) {
    return _get(plannerItem, 'details.sourceId');
  },

  getIdToFetchTranslations(plannerItem) {
    return isPost(plannerItem) || this.isMessageChildVariant(plannerItem)
      ? this.sourceMessageId(plannerItem)
      : id(plannerItem);
  },

  getSourceLocaleId(plannerItem) {
    return _get(plannerItem, 'details.locale');
  },

  isAutoImported(plannerItem) {
    return !!plannerItem?.details?.autoImported;
  },

  isInApprovalStatus(plannerItem) {
    const messageStatus = status(plannerItem);
    return APPROVAL_STATUSES.has(messageStatus);
  },

  /**
   * Returns true if the message is confidential for the logged-in user
   */
  isEmbargoed: _property('details.embargoed'),

  isDarkPost(plannerItem) {
    if (isDraft(plannerItem)) {
      const additional = _head(channelSpecificAdditionalProperties(plannerItem)); // for grouped planner item, we get the adapted channel specific planner item here
      return _get(additional, 'data.IS_DARK_POST.0') === 'true';
    }
    return _get(plannerItem, 'details.isDarkPost');
  },
  isCreativeOnlyPost(plannerItem) {
    return _get(plannerItem, 'details.isCreativeOnlyPost');
  },

  isCreatedInAcl(plannerItem) {
    return _get(plannerItem, 'details.postCreationSource') === 'CREATIVE_LIBRARY';
  },

  isAclPlannerItem(plannerItem) {
    return this.isCreativeOnlyPost(plannerItem) || this.isCreatedInAcl(plannerItem);
  },

  workflowNames: _property('details.workflowNames'),

  isEmbargoedMessage,

  hasVariants(plannerItem) {
    if (isPost(plannerItem)) {
      return _get(plannerItem, 'details.additional.HAS_VARIANTS.0') === 'true';
    }
    const additionalProperty =
      channelSpecificAdditionalProperty(plannerItem, { channelType: CHANNEL_TYPES.OUTBOUND }) || EMPTY_OBJECT_READONLY;
    return _get(additionalProperty, 'data.HAS_VARIANTS.0') === 'true';
  },

  childVariantCount(plannerItem) {
    if (isPost(plannerItem)) {
      return _size(_get(plannerItem, 'details.additional.VARIANT_MESSAGE_IDS'));
    }
    const additionalProperty =
      channelSpecificAdditionalProperty(plannerItem, { channelType: CHANNEL_TYPES.OUTBOUND }) || EMPTY_OBJECT_READONLY;
    return _size(_get(additionalProperty, 'data.VARIANT_MESSAGE_IDS'));
  },

  cTs,

  authId,
};

export default READER;