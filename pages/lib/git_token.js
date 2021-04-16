import {createOAuthUserAuth} from "https://cdn.skypack.dev/@octokit/auth-oauth-user";

const auth = createOAuthUserAuth({
                                    clientId: "32748c79e2f3936ca0cb",
                                    clientSecret: "c871dbe5c837905a541c03d33fb44858c5973a8b",
                                    code: urlCode
                                });

export const { token } = await auth();