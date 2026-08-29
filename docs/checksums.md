# SHA-256 checksums — DLSS 5 Swapper v1.0.0

## Release artifacts
```
232db95cecc4695f1dd96f6273caa516c6794d5120268e37d340715a510722ed  DLSS5-Swapper-Setup-1.0.0.exe
2d49d858ece2829d74ceb7e6b8ae56dbd2e96a0488f2194ed30c2176c7466126  DLSS5-Swapper-1.0.0-portable.exe
```

## VirusTotal

Both artifacts scan clean — 0/65, no engine detects either one.

- [Installer](https://www.virustotal.com/gui/file/232db95cecc4695f1dd96f6273caa516c6794d5120268e37d340715a510722ed)
- [Portable](https://www.virustotal.com/gui/file/2d49d858ece2829d74ceb7e6b8ae56dbd2e96a0488f2194ed30c2176c7466126)

## Bundled third-party files (resources/payload)

These are shipped byte-for-byte as obtained; none are built or modified by this project.
```
afe4c8f13048306307983b8b3d41d5bf00a86820440b0e57dea10950e1176445  ReShade_Setup_6.8.0_Addon.exe      v6.8.0.0
87aef9ddd937c7241e6bf8d8efea0045d63559135e254c60dab316db3d3a4aee  renodx-dlss5.addon64               v0.2026.827.2036
f80ecfbce8a84a5b4c1c59dc5a9f0ee9cf5a989c9fba3a9486ee874f7595a454  nis.license.txt                    
c85f971ce023c9f3492fc7455f0b01a24ba18ea39636407a846902c4360b0b7e  nvngx_dlss.dll                     v310.8.0.0
b6f4b4b6f582c9523ed4dfe89a4fae4cfc9c61f9c57e335e00ccee5f9b2b2e4b  nvngx_dlss.license.txt             
5d5cbf14d2727d47f93fd10bf77bd91708ae122482a6f86fd564971641ebd47b  nvngx_dlssg.dll                    v310.8.0.0
e16bcf15e16e13f527491cdf7845b2fe6521a738d8f7c9c721866a8496e1fc8e  nvngx_dlssnr.dll                   v310.8.0.0
ebf83c07fb3b2939908c3795d887afde3161c89a28ba391724efc784ce1bdabe  reflex.license.txt                 
a4b2b5acbe49fbc6d44dd432cac19cd53218f698b2539dc7ed0fb268c72cfc8d  sl.common.dll                      v2.13.0.0
1eb5fb3d6f01d340fe086d981cc2de4f18aa6d05ee276e5cf28ecd54818dcc8b  sl.dlss.dll                        v2.13.0.0
b8b5effd7debdb750abd216de43385fb653261712bc315d85eba68811fb3ee02  sl.dlss_g.dll                      v2.13.0.0
9f6672e5e0170dc118a3188d21bda187e1fc1aa3502895b21ab846d23165c11d  sl.dlss_nr.dll                     v2.13.0.0
27b2190057994c0b287c2c5716953bf1586f6499ac12fbbb2092b9aaf8396570  sl.interposer.dll                  v2.13.0.0
6039e38a1af56c8e86f3e936596e2db910bf3d76bbf4268562a3b13763049dfa  sl.nis.dll                         v2.13.0.0
12aa4e76c28a27c735e4ecb3072f44d09428acb107b70ac38e4bd48ddb05f88d  sl.pcl.dll                         v2.13.0.0
ecf12973cdcec2ffced2ea77b1c7e45f4d387e7c864ddb5531b66a6f947effb3  sl.reflex.dll                      v2.13.0.0
```

## Authenticode signatures

Every NVIDIA binary is shipped exactly as published by NVIDIA and carries a
valid signature. Verify with `Get-AuthenticodeSignature` on any of them.

| File | Status | Signer |
| --- | --- | --- |
| nvngx_dlss.dll | Valid | NVIDIA Corporation |
| nvngx_dlssg.dll | Valid | NVIDIA Corporation |
| nvngx_dlssnr.dll | Valid | NVIDIA Corporation |
| sl.common.dll | Valid | NVIDIA Corporation |
| sl.dlss.dll | Valid | NVIDIA Corporation |
| sl.dlss_g.dll | Valid | NVIDIA Corporation |
| sl.dlss_nr.dll | Valid | NVIDIA Corporation |
| sl.interposer.dll | Valid | NVIDIA Corporation |
| sl.nis.dll | Valid | NVIDIA Corporation |
| sl.pcl.dll | Valid | NVIDIA Corporation |
| sl.reflex.dll | Valid | NVIDIA Corporation |
| ReShade_Setup_6.8.0_Addon.exe | Signed by "ReShade" (chain not validated on this machine) | crosire / ReShade |
| renodx-dlss5.addon64 | Not signed | RenoDX community add-on |

The application itself is not code-signed — there is no certificate behind this
project.
