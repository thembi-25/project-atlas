'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type {
  BuildingDto,
  PropertyCustomerAssociationDto,
  PropertyDto,
  RoomDto,
} from '@/lib/properties-types';
import type { AssetDto, AssetTypeDto } from '@/lib/assets-types';

const PROPERTY_TYPE_LABELS: Record<PropertyDto['property_type'], string> = {
  residential_single_family: 'Residential (single-family)',
  residential_multi_unit: 'Residential (multi-unit)',
  commercial: 'Commercial',
};

/**
 * Property detail page — properties-prd.md §13: "address, access notes,
 * Buildings/Rooms tree, Asset list, and a chronological service-history
 * timeline spanning all Customer associations." This is structural
 * foundation for future Job/service workflows (per the Property
 * Intelligence pillar) — it does not implement or fake Jobs, which
 * doesn't exist until Sprint 4 — see docs/13-roadmap/
 * SPRINT-3-COMPLETION-REPORT.md, "Known Limitations."
 */
export default function PropertyDetailPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <PropertyDetailPageContent />
    </Suspense>
  );
}

function PropertyDetailPageContent(): JSX.Element {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [property, setProperty] = useState<PropertyDto | null>(null);
  const [buildings, setBuildings] = useState<BuildingDto[]>([]);
  const [roomsByBuilding, setRoomsByBuilding] = useState<Record<string, RoomDto[]>>({});
  const [assets, setAssets] = useState<AssetDto[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetTypeDto[]>([]);
  const [associations, setAssociations] = useState<PropertyCustomerAssociationDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setError(null);
    try {
      const qs = new URLSearchParams({ organization_id: organizationId });
      const [propertyResult, buildingsResult, assetsResult, assetTypesResult, associationsResult] =
        await Promise.all([
          apiRequest<PropertyDto>(`/api/v1/properties/${params.id}?${qs.toString()}`),
          apiRequest<BuildingDto[]>(`/api/v1/properties/${params.id}/buildings?${qs.toString()}`),
          apiRequest<AssetDto[]>(
            `/api/v1/assets?${new URLSearchParams({ organization_id: organizationId, property_id: params.id, limit: '100' }).toString()}`,
          ),
          apiRequest<AssetTypeDto[]>(`/api/v1/asset_types?${qs.toString()}`),
          apiRequest<PropertyCustomerAssociationDto[]>(
            `/api/v1/properties/${params.id}/customer-associations?${qs.toString()}`,
          ),
        ]);
      setProperty(propertyResult.data);
      setBuildings(buildingsResult.data);
      setAssets(assetsResult.data);
      setAssetTypes(assetTypesResult.data);
      setAssociations(associationsResult.data);

      const roomEntries = await Promise.all(
        buildingsResult.data.map(async (building) => {
          const rooms = await apiRequest<RoomDto[]>(
            `/api/v1/buildings/${building.id}/rooms?${qs.toString()}`,
          );
          return [building.id, rooms.data] as const;
        }),
      );
      setRoomsByBuilding(Object.fromEntries(roomEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Property.');
    }
  }, [organizationId, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL.
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

  if (!property) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }

  const currentAssociation = associations.find((a) => a.effective_to === null);
  const rooms = Object.values(roomsByBuilding).flat();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{property.address_line1}</h1>
        <p className="text-muted-foreground text-sm">
          {PROPERTY_TYPE_LABELS[property.property_type]}
          {property.deleted_at ? ' · archived' : ''}
        </p>
      </div>

      <dl className="mb-8 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Address</dt>
        <dd>
          {[
            property.address_line1,
            property.address_line2,
            property.address_city,
            property.address_region,
            property.address_postal_code,
          ]
            .filter(Boolean)
            .join(', ')}
        </dd>
        <dt className="text-muted-foreground">Access notes</dt>
        <dd>{property.access_notes ?? '—'}</dd>
        <dt className="text-muted-foreground">Current Customer</dt>
        <dd>{currentAssociation ? currentAssociation.customer_id : 'None on record'}</dd>
      </dl>

      <AddCustomerAssociationForm
        propertyId={property.id}
        organizationId={organizationId}
        onAdded={() => void load()}
      />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Buildings &amp; Rooms</h2>
      <ul className="divide-border border-border mb-4 divide-y rounded-md border">
        {buildings.map((building) => (
          <li key={building.id} className="px-4 py-2 text-sm">
            <div className="font-medium">{building.name}</div>
            <ul className="text-muted-foreground ml-4 mt-1">
              {(roomsByBuilding[building.id] ?? []).map((room) => (
                <li key={room.id}>{room.name}</li>
              ))}
            </ul>
          </li>
        ))}
        {buildings.length === 0 ? (
          <li className="text-muted-foreground px-4 py-2 text-sm">No Buildings.</li>
        ) : null}
      </ul>
      <AddBuildingForm
        propertyId={property.id}
        organizationId={organizationId}
        onAdded={() => void load()}
      />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Assets</h2>
      <ul className="divide-border border-border mb-4 divide-y rounded-md border">
        {assets.map((asset) => (
          <li key={asset.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <div>
              <a
                className="font-medium hover:underline"
                href={`/assets/${asset.id}?organization_id=${organizationId}`}
              >
                {asset.manufacturer_name ?? 'Asset'} {asset.model_number ?? ''}
              </a>
              <div className="text-muted-foreground">
                {[asset.serial_number, asset.status].filter(Boolean).join(' · ')}
              </div>
            </div>
          </li>
        ))}
        {assets.length === 0 ? (
          <li className="text-muted-foreground px-4 py-2 text-sm">No Assets.</li>
        ) : null}
      </ul>
      <AddAssetForm
        propertyId={property.id}
        organizationId={organizationId}
        buildings={buildings}
        rooms={rooms}
        assetTypes={assetTypes}
        onAdded={() => void load()}
      />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Service history</h2>
      <p className="text-muted-foreground mb-2 text-xs">
        Spans every Customer association period — not just the current one. Job history will appear
        here once the Jobs module is implemented.
      </p>
      <ul className="divide-border border-border divide-y rounded-md border">
        {[...assets]
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((asset) => (
            <li key={asset.id} className="px-4 py-2 text-sm">
              {new Date(asset.created_at).toLocaleDateString()} — Asset recorded:{' '}
              {asset.manufacturer_name ?? 'Unknown manufacturer'} {asset.model_number ?? ''}
            </li>
          ))}
        {assets.length === 0 ? (
          <li className="text-muted-foreground px-4 py-2 text-sm">No history yet.</li>
        ) : null}
      </ul>
    </main>
  );
}

function AddCustomerAssociationForm({
  propertyId,
  organizationId,
  onAdded,
}: {
  propertyId: string;
  organizationId: string;
  onAdded: () => void;
}): JSX.Element {
  const [customerId, setCustomerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/properties/${propertyId}/customer-associations`, {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId, customer_id: customerId }),
      });
      setCustomerId('');
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set Customer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-3 text-sm">
      <div className="flex-1">
        <Label htmlFor="customer_id">Set current Customer (Customer ID)</Label>
        <Input
          id="customer_id"
          required
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Set Customer'}
      </Button>
    </form>
  );
}

function AddBuildingForm({
  propertyId,
  organizationId,
  onAdded,
}: {
  propertyId: string;
  organizationId: string;
  onAdded: () => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/properties/${propertyId}/buildings`, {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId, name }),
      });
      setName('');
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add Building.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-3 text-sm">
      <div className="flex-1">
        <Label htmlFor="building_name">Add a Building</Label>
        <Input
          id="building_name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add Building'}
      </Button>
    </form>
  );
}

function AddAssetForm({
  propertyId,
  organizationId,
  buildings,
  rooms,
  assetTypes,
  onAdded,
}: {
  propertyId: string;
  organizationId: string;
  buildings: BuildingDto[];
  rooms: RoomDto[];
  assetTypes: AssetTypeDto[];
  onAdded: () => void;
}): JSX.Element {
  const [assetTypeId, setAssetTypeId] = useState('');
  const [manufacturerName, setManufacturerName] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/assets', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          property_id: propertyId,
          building_id: buildingId || undefined,
          room_id: roomId || undefined,
          asset_type_id: assetTypeId,
          manufacturer_name: manufacturerName || undefined,
          model_number: modelNumber || undefined,
          serial_number: serialNumber || undefined,
        }),
      });
      setManufacturerName('');
      setModelNumber('');
      setSerialNumber('');
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add Asset.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-border flex flex-col gap-3 rounded-md border p-4 text-sm"
    >
      <p className="font-medium">Record an Asset</p>
      <div>
        <Label htmlFor="asset_type_id">Asset type</Label>
        <select
          id="asset_type_id"
          required
          className="border-border w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          value={assetTypeId}
          onChange={(event) => setAssetTypeId(event.target.value)}
        >
          <option value="" disabled>
            Select…
          </option>
          {assetTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <Label htmlFor="manufacturer_name">Manufacturer</Label>
          <Input
            id="manufacturer_name"
            value={manufacturerName}
            onChange={(event) => setManufacturerName(event.target.value)}
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="model_number">Model</Label>
          <Input
            id="model_number"
            value={modelNumber}
            onChange={(event) => setModelNumber(event.target.value)}
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="serial_number">Serial</Label>
          <Input
            id="serial_number"
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <Label htmlFor="asset_building_id">Building</Label>
          <select
            id="asset_building_id"
            className="border-border w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            value={buildingId}
            onChange={(event) => {
              setBuildingId(event.target.value);
              setRoomId('');
            }}
          >
            <option value="">Unspecified</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <Label htmlFor="asset_room_id">Room</Label>
          <select
            id="asset_room_id"
            className="border-border w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            disabled={!buildingId}
          >
            <option value="">Unspecified</option>
            {rooms
              .filter((r) => r.building_id === buildingId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Recording…' : 'Record Asset'}
        </Button>
      </div>
    </form>
  );
}
