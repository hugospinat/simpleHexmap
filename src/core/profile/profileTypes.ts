import type { UserId, UserRecord } from "../auth/authTypes.js";

export type ProfileId = UserId;

export type ProfileRecord = UserRecord;

export type MapPermissions = {
  ownerProfileId: ProfileId;
  gmProfileIds: ProfileId[];
};

export function canOpenMapAsGM(profileId: ProfileId, permissions: MapPermissions): boolean {
  return permissions.ownerProfileId === profileId || permissions.gmProfileIds.includes(profileId);
}

export function normalizeMapPermissions(permissions: MapPermissions): MapPermissions {
  return {
    ownerProfileId: permissions.ownerProfileId,
    gmProfileIds: Array.from(new Set(permissions.gmProfileIds)).filter((profileId) => profileId !== permissions.ownerProfileId)
  };
}
