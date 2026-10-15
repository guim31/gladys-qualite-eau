# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **No secret**: the services it reads (Hub'Eau, baignades.sante.gouv.fr, geo.api.gouv.fr) are
  public and keyless; the configuration holds a house, INSEE codes and bathing site codes.
- **The location of your house** (declared `location: true`): sent only to geo.api.gouv.fr,
  rounded to about 100 m, to find the commune and the communes around it. It is never written to
  `/data` nor to the logs.
- **`/data/qualite-eau.json`**: the last results read, the names of the communes and sites, the
  selector of the house and the codes of the communes around it. Deleting it is harmless.
- **Network**: outbound HTTPS only, to the three services above; nothing listens.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the third-party services the integration reads.
