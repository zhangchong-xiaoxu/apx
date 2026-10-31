// The standalone docs app cannot import the protocol package, so keep its release source explicit here.
export const RELEASE_REPOSITORY = "zhangchong-xiaoxu/apx";
export const RELEASE_API = `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases?per_page=20`;
export const RELEASES_PAGE = `https://github.com/${RELEASE_REPOSITORY}/releases?q=v2&expanded=true`;
