# Disk Encryption Guide (LUKS)

**Purpose**: Implement full disk encryption on production servers using LUKS (Linux Unified Key Setup)  
**Target**: Production servers hosting CEO Dashboard ERP  
**Encryption Standard**: AES-256 with XTS  
**Date**: 2024-01-19

---

## Overview

Disk encryption protects data at rest by encrypting the entire disk or specific partitions. This guide provides step-by-step instructions for implementing LUKS encryption on Linux servers.

**Important**: This process requires server downtime and data backup. Do not attempt on production without proper testing in staging.

---

## Prerequisites

### Before Starting
- [ ] Full system backup completed
- [ ] Staging server available for testing
- [ ] LUKS installed (`cryptsetup`)
- [ ] Encryption key storage solution ready
- [ ] Recovery procedures documented
- [ ] Maintenance window scheduled
- [ ] Team notified of downtime

### Required Tools
```bash
# Install cryptsetup (LUKS)
sudo apt-get update
sudo apt-get install cryptsetup

# Verify installation
cryptsetup --version
```

---

## Backup Procedure

### 1. Create Full System Backup
```bash
# Backup database
./scripts/backup-database.sh pre-encryption

# Backup application files
tar -czf /tmp/ceodashboard-app-backup-$(date +%Y%m%d).tar.gz /opt/ceodashboard

# Backup configuration files
tar -czf /tmp/ceodashboard-config-backup-$(date +%Y%m%d).tar.gz /etc/ceodashboard

# Verify backups
ls -lh /tmp/ceodashboard-*-backup-*.tar.gz
```

### 2. Document Current Disk Layout
```bash
# List block devices
lsblk

# List partitions
fdisk -l

# Save to file
lsblk > /tmp/pre-encryption-disk-layout.txt
fdisk -l >> /tmp/pre-encryption-disk-layout.txt
```

---

## Encryption Procedure

### Option A: Encrypt New Disk (Recommended for New Servers)

#### 1. Identify Target Disk
```bash
# List available disks
lsblk

# Example: /dev/sdb (data disk)
TARGET_DISK="/dev/sdb"
```

#### 2. Encrypt the Disk
```bash
# WARNING: This will erase all data on the disk
sudo cryptsetup luksFormat $TARGET_DISK

# You will be prompted for a passphrase
# Use a strong passphrase (minimum 20 characters)
# Store this passphrase securely (e.g., password manager)
```

#### 3. Open Encrypted Disk
```bash
# Open the encrypted disk
sudo cryptsetup luksOpen $TARGET_DISK encrypted_disk

# This creates a mapped device at /dev/mapper/encrypted_disk
```

#### 4. Create Filesystem
```bash
# Create ext4 filesystem
sudo mkfs.ext4 /dev/mapper/encrypted_disk

# Label the filesystem
sudo e2label /dev/mapper/encrypted_disk ceodashboard_data
```

#### 5. Mount the Encrypted Disk
```bash
# Create mount point
sudo mkdir -p /mnt/encrypted

# Mount the disk
sudo mount /dev/mapper/encrypted_disk /mnt/encrypted

# Verify mount
df -h /mnt/encrypted
```

#### 6. Restore Data
```bash
# Restore database
./scripts/restore-database.sh backup_pre-encryption.sql.gz /mnt/encrypted

# Restore application files
tar -xzf /tmp/ceodashboard-app-backup-*.tar.gz -C /mnt/encrypted

# Restore configuration files
tar -xzf /tmp/ceodashboard-config-backup-*.tar.gz -C /mnt/encrypted
```

#### 7. Configure Auto-Mount
```bash
# Add to /etc/crypttab for auto-open on boot
echo "encrypted_disk /dev/sdb none luks" | sudo tee -a /etc/crypttab

# Add to /etc/fstab for auto-mount
echo "/dev/mapper/encrypted_disk /mnt/encrypted ext4 defaults 0 0" | sudo tee -a /etc/fstab

# Test auto-mount
sudo umount /mnt/encrypted
sudo cryptsetup luksClose encrypted_disk
sudo mount -a
```

---

### Option B: Encrypt Existing Disk (In-Place Encryption)

**Warning**: This is more complex and risky. Only attempt if Option A is not possible.

#### 1. Install cryptsetup-reencrypt
```bash
sudo apt-get install cryptsetup-reencrypt
```

#### 2. Reboot to Single User Mode
```bash
sudo systemctl set-default multi-user.target
sudo reboot
```

#### 3. Encrypt the Disk
```bash
# This will encrypt the disk in-place
# WARNING: This process can take hours depending on disk size
sudo cryptsetup-reencrypt /dev/sdb

# You will be prompted for a passphrase
# Do not interrupt this process
```

#### 4. Reboot to Normal Mode
```bash
sudo systemctl set-default graphical.target
sudo reboot
```

---

## Key Management

### 1. Store Encryption Key Securely

#### Option A: Key File
```bash
# Generate random key file
sudo dd if=/dev/urandom of=/root/encryption_key bs=4096 count=1

# Set permissions
sudo chmod 400 /root/encryption_key

# Add key to LUKS
sudo cryptsetup luksAddKey /dev/sdb /root/encryption_key

# Store key file in secure location (e.g., separate encrypted USB drive)
```

#### Option B: Key in HashiCorp Vault
```bash
# Store passphrase in Vault
vault kv put secret/ceodashboard/disk-encryption passphrase="your-passphrase"

# Retrieve passphrase during boot
# (requires custom init script)
```

### 2. Create Recovery Key
```bash
# Generate recovery key
sudo cryptsetup luksAddKey /dev/sdb --key-slot 1

# Store recovery key in secure offline location
# (e.g., safety deposit box, password manager)
```

---

## Verification

### 1. Verify Encryption Status
```bash
# Check if disk is encrypted
sudo cryptsetup status encrypted_disk

# Expected output:
# /dev/mapper/encrypted_disk is active and is the LUKS encrypted device.
```

### 2. Verify Data Integrity
```bash
# Check database
psql -U postgres -d ceodashboard -c "SELECT COUNT(*) FROM sales;"

# Check application files
ls -la /mnt/encrypted

# Run application health check
curl http://localhost:3001/api/health
```

### 3. Test Recovery Procedure
```bash
# Simulate server reboot
sudo reboot

# Verify disk auto-mounts after reboot
df -h /mnt/encrypted

# Verify application starts
systemctl status ceodashboard
```

---

## Recovery Procedures

### Scenario 1: Lost Passphrase
```bash
# Use recovery key
sudo cryptsetup luksOpen /dev/sdb encrypted_disk --key-slot 1

# If recovery key also lost, data is permanently inaccessible
```

### Scenario 2: Disk Failure
```bash
# If encrypted disk fails, restore from backup
# This is why backups are critical
./scripts/restore-database.sh latest-backup.sql.gz
```

### Scenario 3: Corrupted LUKS Header
```bash
# Backup LUKS header
sudo cryptsetup luksHeaderBackup /dev/sdb --header-backup-file /root/luks-header-backup

# Restore LUKS header if corrupted
sudo cryptsetup luksHeaderRestore /dev/sdb --header-backup-file /root/luks-header-backup
```

---

## Monitoring

### Monitor Encrypted Disk Health
```bash
# Check disk health
sudo smartctl -a /dev/sdb

# Monitor disk I/O
iostat -x 5

# Monitor disk space
df -h /mnt/encrypted
```

### Monitor Encryption Performance
```bash
# Check encryption overhead
cryptsetup benchmark

# Monitor CPU usage during I/O
top -p $(pgrep -f cryptsetup)
```

---

## Security Considerations

### 1. Key Storage
- Never store passphrase in plaintext
- Use hardware security module (HSM) if available
- Rotate keys annually
- Limit access to key files

### 2. Access Control
```bash
# Restrict access to cryptsetup
sudo chmod 750 /usr/sbin/cryptsetup

# Audit cryptsetup usage
sudo auditctl -w /usr/sbin/cryptsetup -p x -k disk_encryption
```

### 3. Physical Security
- Secure server room access
- Use boot loader password
- Disable USB ports if possible
- Use TPM (Trusted Platform Module) if available

---

## Troubleshooting

### Issue: Disk Won't Auto-Mount
```bash
# Check crypttab
cat /etc/crypttab

# Check fstab
cat /etc/fstab

# Manual mount
sudo cryptsetup luksOpen /dev/sdb encrypted_disk
sudo mount /dev/mapper/encrypted_disk /mnt/encrypted
```

### Issue: Wrong Passphrase
```bash
# Try different key slots
sudo cryptsetup luksOpen /dev/sdb encrypted_disk --key-slot 1

# Check how many attempts remaining
sudo cryptsetup luksDump /dev/sdb
```

### Issue: Slow Performance
```bash
# Check encryption algorithm
sudo cryptsetup status encrypted_disk

# Consider using faster algorithm (e.g., aes-xts-plain64)
# Re-encrypt if necessary
```

---

## Rollback Procedure

If encryption causes issues, rollback to unencrypted state:

```bash
# Unmount encrypted disk
sudo umount /mnt/encrypted
sudo cryptsetup luksClose encrypted_disk

# Remove from crypttab
sudo sed -i '/encrypted_disk/d' /etc/crypttab

# Remove from fstab
sudo sed -i '/encrypted_disk/d' /etc/fstab

# Restore from backup (if data was lost)
./scripts/restore-database.sh pre-encryption-backup.sql.gz
```

---

## Checklist

### Pre-Encryption
- [ ] Full backup completed
- [ ] Backup verified
- [ ] Disk layout documented
- [ ] Encryption passphrase generated
- [ ] Recovery key generated
- [ ] Key storage secured
- [ ] Team notified
- [ ] Maintenance window scheduled

### During Encryption
- [ ] Disk encrypted successfully
- [ ] Filesystem created
- [ ] Data restored
- [ ] Mount point configured
- [ ] Auto-mount configured
- [ ] Application verified

### Post-Encryption
- [ ] Encryption status verified
- [ ] Data integrity verified
- [ ] Recovery procedure tested
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Team trained on recovery

---

## Contact Information

- **DevOps Lead**: [Contact]
- **DBA**: [Contact]
- **Security Lead**: [Contact]
- **24/7 Support**: [Phone]

---

## References

- LUKS Documentation: https://gitlab.com/cryptsetup/cryptsetup
- Ubuntu Disk Encryption Guide: https://ubuntu.com/server/docs/disk-encryption
- NIST Encryption Guidelines: https://csrc.nist.gov/publications/detail/sp/800-111/final
