# Integrated gateway

This Bundle incorporates **dsh-mobile 0.6.3**, by saya-ch and contributors,
under Apache-2.0. Upstream: https://github.com/saya-ch/dsh-mobile/tree/v0.6.3.

The original runtime, source maps (including sources), documentation, package
metadata, LICENSE, THIRD_PARTY_NOTICES and FUNNEL_THIRD_PARTY_LICENSES are retained
under `vendor/dsh-mobile/`. `upstream-lock.json` records the npm archive integrity
and each original file's SHA-256. The three original Funnel executables are
verified and included when packaging; they are not stored in Git.

Local integration changes: one owning Bundle and gateway entry, duplicate gateway
protection, and a browser entry with its module ID changed to this package's name.
The original gateway and browser artifacts remain unmodified in the archive.
The active derivative replaces the upstream release-update region with project
distribution metadata, removes its npm self-updater, changes user-facing project
links and style ownership, and adds project help, feedback and version notes.
The original licenses and upstream attribution remain intact.

The source package is private and this notice does not change licensing of other
project files. See the retained upstream license and third-party notices for
their respective terms.
