export type ProfileId = string;

export type ProfileRecord = {
  id: ProfileId;
  username: string;
  createdAt: string;
  updatedAt: string;
};

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
