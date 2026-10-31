import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RouteGuard } from '@/components/shared/RouteGuard';
import { useAuthStore } from '@/features/auth/authStore';

describe('RouteGuard (RBAC Route Protection)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      currentUser: null,
      roles: [],
      roleCodes: [],
      isLoading: false,
      isLocked: false,
      startInUserSelect: false,
      activeSession: null,
      error: null,
    });
  });

  it('memblokir Kasir dari halaman Pengaturan dan menampilkan layar Akses Dibatasi', () => {
    useAuthStore.setState({
      currentUser: {
        id: 'usr_supri',
        name: 'Supri',
        pin_hash: 'h',
        pin_salt: 's',
        pin_kdf: 'pbkdf2',
        pin_iterations: 100000,
        status: 'active',
        failed_attempts: 0,
        created_at: 1,
        created_by: 'sys',
        updated_at: 1,
        updated_by: 'sys',
        row_version: 1,
      },
      roleCodes: ['cashier'],
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <RouteGuard permission="settings.manage" title="Pengaturan Sistem">
          <div data-testid="secret-settings">Halaman Rahasia Pengaturan</div>
        </RouteGuard>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('secret-settings')).toBeNull();
    expect(screen.getByText('Akses Dibatasi')).toBeDefined();
    expect(screen.getByText('Supri')).toBeDefined();
    expect(screen.getByText('Kasir')).toBeDefined();
    expect(screen.getByText('Ke Ringkasan')).toBeDefined();
  });

  it('mengizinkan Kasir membuka 4 halaman Mode Baca Aman (Ringkasan, Produk, Inventaris, Kedaluwarsa)', () => {
    useAuthStore.setState({
      currentUser: {
        id: 'usr_supri',
        name: 'Supri',
        pin_hash: 'h',
        pin_salt: 's',
        pin_kdf: 'pbkdf2',
        pin_iterations: 100000,
        status: 'active',
        failed_attempts: 0,
        created_at: 1,
        created_by: 'sys',
        updated_at: 1,
        updated_by: 'sys',
        row_version: 1,
      },
      roleCodes: ['cashier'],
      isLoading: false,
    });

    const { unmount } = render(
      <MemoryRouter>
        <RouteGuard permission="dashboard.view" title="Ringkasan Toko">
          <div data-testid="read-dashboard">Ringkasan Terbuka</div>
        </RouteGuard>
        <RouteGuard permission="catalog.view" title="Katalog Produk">
          <div data-testid="read-catalog">Katalog Terbuka</div>
        </RouteGuard>
        <RouteGuard permission="inventory.view" title="Inventaris & Stok">
          <div data-testid="read-inventory">Inventaris Terbuka</div>
        </RouteGuard>
        <RouteGuard permission="expiry.view" title="Monitoring Kedaluwarsa">
          <div data-testid="read-expiry">Kedaluwarsa Terbuka</div>
        </RouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByTestId('read-dashboard')).toBeDefined();
    expect(screen.getByTestId('read-catalog')).toBeDefined();
    expect(screen.getByTestId('read-inventory')).toBeDefined();
    expect(screen.getByTestId('read-expiry')).toBeDefined();
    expect(screen.queryByText('Akses Dibatasi')).toBeNull();
    unmount();
  });

  it('mengizinkan Owner mengakses halaman Pengaturan', () => {
    useAuthStore.setState({
      currentUser: {
        id: 'usr_owner',
        name: 'Syafiq',
        pin_hash: 'h',
        pin_salt: 's',
        pin_kdf: 'pbkdf2',
        pin_iterations: 100000,
        status: 'active',
        created_at: 1,
        created_by: 'sys',
        updated_at: 1,
        updated_by: 'sys',
        failed_attempts: 0,
        row_version: 1,
      },
      roleCodes: ['owner'],
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <RouteGuard permission="settings.manage" title="Pengaturan Sistem">
          <div data-testid="secret-settings">Halaman Rahasia Pengaturan</div>
        </RouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByTestId('secret-settings')).toBeDefined();
    expect(screen.queryByText('Akses Dibatasi')).toBeNull();
  });

  it('mengizinkan Supervisor pada rute allowedRoles owner & supervisor namun menolak Staf Gudang', () => {
    useAuthStore.setState({
      currentUser: {
        id: 'usr_gudang',
        name: 'Rudi Gudang',
        pin_hash: 'h',
        pin_salt: 's',
        pin_kdf: 'pbkdf2',
        pin_iterations: 100000,
        status: 'active',
        created_at: 1,
        created_by: 'sys',
        updated_at: 1,
        updated_by: 'sys',
        failed_attempts: 0,
        row_version: 1,
      },
      roleCodes: ['stock_clerk'],
      isLoading: false,
    });

    const { unmount } = render(
      <MemoryRouter>
        <RouteGuard allowedRoles={['owner', 'supervisor']} title="Pengaturan Sistem">
          <div data-testid="panel-audit">Panel Audit</div>
        </RouteGuard>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('panel-audit')).toBeNull();
    expect(screen.getByText('Staf Gudang')).toBeDefined();
    expect(screen.getByText('Ke Katalog Produk')).toBeDefined();
    unmount();

    // Ubah ke Supervisor -> diizinkan
    useAuthStore.setState({
      roleCodes: ['supervisor'],
    });

    render(
      <MemoryRouter>
        <RouteGuard allowedRoles={['owner', 'supervisor']} title="Pengaturan Sistem">
          <div data-testid="panel-audit">Panel Audit</div>
        </RouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByTestId('panel-audit')).toBeDefined();
  });
});
