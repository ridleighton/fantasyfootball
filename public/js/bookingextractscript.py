import requests
import csv
import time
import pandas as pd
import re

# Configuration
TOKEN_URL = "https://overturehqapi.com/access_token"
BASE_URL = "https://overturehqapi.com/api/bookings"

CLIENT_ID = "298bfb26a3064407e32c671ab1a11f78"
CLIENT_SECRET = "f08773a82b5a248188b90a8ad05896a19e3d747019d38ffc654490e5360d3349cf49c899fb571adc374eb391aebcc4ad99a9eb75d93ec33c3c9a87e9d40735c6"

# Address parsing function
def parse_venue_address(venue_address, venue_state='', venue_country='', venue_zip=''):
    """
    Parse venue address working backwards from ZIP/State to properly identify components.
    """
    address = str(venue_address).strip()
    
    parsed = {
        'Parsed Street': '',
        'Parsed City': '',
        'Parsed State': '',
        'Parsed Country': '',
        'Parsed ZIP': ''
    }
    
    if not address or address == '' or address == 'nan':
        # Use hint columns as fallback
        if venue_country and str(venue_country).strip() and str(venue_country).lower() != 'null':
            parsed['Parsed Country'] = str(venue_country).strip()
        if venue_zip and str(venue_zip).strip() and str(venue_zip).lower() != 'null':
            parsed['Parsed ZIP'] = str(venue_zip).strip()
        if venue_state and str(venue_state).strip():
            state_match = re.search(r'\b([A-Z]{2})\b', str(venue_state))
            if state_match:
                parsed['Parsed State'] = state_match.group(1)
            if ',' in str(venue_state):
                parsed['Parsed City'] = str(venue_state).split(',')[0].strip()
        return parsed
    
    # Normalize spacing
    address = re.sub(r'\s*,\s*', ', ', address)
    address = re.sub(r'\s+', ' ', address)
    
    parts = [p.strip() for p in address.split(',')]
    
    US_STATES = {'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 
                 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
                 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
                 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
                 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'}
    
    CANADIAN_PROVINCES = {'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 
                          'PE', 'QC', 'SK', 'YT'}
    
    ALL_STATES = US_STATES | CANADIAN_PROVINCES
    
    # Step 1: Find ZIP/Postal code
    zip_code = None
    zip_part_idx = -1
    
    for i in range(len(parts) - 1, -1, -1):
        part = parts[i]
        us_zip = re.search(r'\b(\d{5}(?:-\d{4})?)\b', part)
        if us_zip:
            zip_code = us_zip.group(1)
            zip_part_idx = i
            parsed['Parsed ZIP'] = zip_code
            break
        can_zip = re.search(r'\b([A-Z]\d[A-Z]\s*\d[A-Z]\d)\b', part)
        if can_zip:
            zip_code = can_zip.group(1).replace(' ', '')
            zip_part_idx = i
            parsed['Parsed ZIP'] = zip_code
            break
    
    # Step 2: Find State
    state_code = None
    state_part_idx = -1
    
    if zip_part_idx >= 0:
        part = parts[zip_part_idx]
        match = re.search(r'\b([A-Z]{2})\s+\d{5}', part)
        if match and match.group(1) in ALL_STATES:
            state_code = match.group(1)
            state_part_idx = zip_part_idx
            parsed['Parsed State'] = state_code
    
    if not state_code:
        start_idx = zip_part_idx if zip_part_idx >= 0 else len(parts)
        for i in range(start_idx - 1, -1, -1):
            part = parts[i]
            match = re.search(r'\b([A-Z]{2})\b', part)
            if match and match.group(1) in ALL_STATES:
                state_code = match.group(1)
                state_part_idx = i
                parsed['Parsed State'] = state_code
                break
    
    # Step 3: Find Country
    country = None
    countries = {
        'united states': 'United States', 'usa': 'United States', 'us': 'United States',
        'canada': 'Canada', 'mexico': 'Mexico', 'iceland': 'Iceland'
    }
    
    for i in range(len(parts) - 1, -1, -1):
        part_lower = parts[i].lower().strip()
        if part_lower in countries:
            country = countries[part_lower]
            parsed['Parsed Country'] = country
            break
    
    if not country and state_code:
        if state_code in US_STATES:
            parsed['Parsed Country'] = 'United States'
        elif state_code in CANADIAN_PROVINCES:
            parsed['Parsed Country'] = 'Canada'
    
    # Step 4: Find City
    city_part_idx = -1
    
    if state_part_idx >= 0:
        part = parts[state_part_idx]
        city_text = part
        if state_code:
            city_text = re.sub(r'\b' + re.escape(state_code) + r'\b', '', city_text)
        if zip_code:
            city_text = re.sub(r'\b' + re.escape(zip_code) + r'\b', '', city_text)
        city_text = city_text.strip()
        
        if city_text:
            parsed['Parsed City'] = city_text
            city_part_idx = state_part_idx
        elif state_part_idx > 0:
            parsed['Parsed City'] = parts[state_part_idx - 1]
            city_part_idx = state_part_idx - 1
    elif zip_part_idx >= 0 and zip_part_idx > 0:
        parsed['Parsed City'] = parts[zip_part_idx - 1]
        city_part_idx = zip_part_idx - 1
    
    # Step 5: Street
    street_parts = []
    
    if city_part_idx > 0:
        street_parts = parts[:city_part_idx]
    
    if street_parts:
        parsed['Parsed Street'] = ', '.join(street_parts)
    elif not parsed['Parsed City'] and len(parts) > 0:
        parsed['Parsed Street'] = parts[0]
    
    # Fallback to hint columns
    if not parsed['Parsed Country'] and venue_country:
        if str(venue_country).strip() and str(venue_country).lower() != 'null':
            parsed['Parsed Country'] = str(venue_country).strip()
    
    if not parsed['Parsed State'] and venue_state:
        if str(venue_state).strip() and str(venue_state).lower() != 'null':
            state_match = re.search(r'\b([A-Z]{2})\b', str(venue_state))
            if state_match:
                parsed['Parsed State'] = state_match.group(1)
    
    if not parsed['Parsed ZIP'] and venue_zip:
        if str(venue_zip).strip() and str(venue_zip).lower() != 'null':
            parsed['Parsed ZIP'] = str(venue_zip).strip()
    
    if not parsed['Parsed City'] and venue_state:
        if str(venue_state).strip() and ',' in str(venue_state):
            city_from_hint = str(venue_state).split(',')[0].strip()
            parsed['Parsed City'] = city_from_hint
    
    return parsed


# Step 1: Get Access Token
print("Getting access token...")
token_payload = {
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "grant_type": "client_credentials"
}

try:
    token_response = requests.post(TOKEN_URL, json=token_payload)
    token_response.raise_for_status()
    access_token = token_response.json()["access_token"]
    print("✓ Access token obtained")
except Exception as e:
    print(f"Error getting token: {e}")
    exit()

# Step 2: Read booking IDs from CSV file
input_file = input("MKI Bookings Extract 11-21-25 RB - Bookings.csv")

try:
    df = pd.read_csv(input_file)
    
    # Check if 'ID' column exists
    if 'ID' not in df.columns:
        print(f"Error: 'ID' column not found in {input_file}")
        print(f"Available columns: {', '.join(df.columns)}")
        exit()
    
    booking_ids = df['ID'].dropna().astype(str).tolist()
    print(f"✓ Found {len(booking_ids)} booking IDs to process")
    
except FileNotFoundError:
    print(f"Error: File '{input_file}' not found")
    exit()
except Exception as e:
    print(f"Error reading file: {e}")
    exit()

# Step 3: Fetch booking details for each ID
print(f"\nStarting to fetch booking details...")
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

all_rows = []
successful = 0
failed = 0

for idx, booking_id in enumerate(booking_ids, 1):
    try:
        url = f"{BASE_URL}/{booking_id}"
        
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        booking = response.json()
        
        # Base booking data (repeated for each row)
        base_data = {
            'booking_id': booking.get('id', ''),
            'accountId': booking.get('accountId', ''),
            'date': booking.get('date', ''),
            'time': booking.get('time', ''),
            'endTime': booking.get('endTime', ''),
            'endDate': booking.get('endDate', ''),
            'timeTbc': booking.get('timeTbc', ''),
            'name': booking.get('name', ''),
            'status': booking.get('status', ''),
            'statusConfirmDate': booking.get('statusConfirmDate', ''),
            'statusChangeDate': booking.get('statusChangeDate', ''),
            'promoterComId': booking.get('promoterComId', ''),
            'promoterCom': booking.get('promoterCom', ''),
            'promoterPer': booking.get('promoterPer', ''),
            'promoterName': booking.get('promoterName', ''),
            'venuePerId': booking.get('venuePerId', ''),
            'venuePer': booking.get('venuePer', ''),
            'venueComId': booking.get('venueComId', ''),
            'venueCom': booking.get('venueCom', ''),
            'venueAddress': booking.get('venueAddress', ''),
            'venueState': booking.get('venueState', ''),
            'venueCountry': booking.get('venueCountry', ''),
            'venueZip': booking.get('venueZip', ''),
            'artistePer': booking.get('artistePer', ''),
            'artisteComId': booking.get('artisteComId', ''),
            'artisteCom': booking.get('artisteCom', ''),
            'servicesNotes': booking.get('servicesNotes', ''),
            'currencyCode': booking.get('currencyCode', ''),
            'confirmedByArtiste': booking.get('confirmedByArtiste', ''),
            'tourId': booking.get('tourId', ''),
            'createdAt': booking.get('createdAt', ''),
            'updatedAt': booking.get('updatedAt', ''),
        }
        
        # Add location data
        location = booking.get('location', {})
        if isinstance(location, dict):
            base_data['location_lat'] = location.get('lat', '')
            base_data['location_lng'] = location.get('lng', '')
        else:
            base_data['location_lat'] = ''
            base_data['location_lng'] = ''
        
        # Parse venue address
        parsed_address = parse_venue_address(
            base_data['venueAddress'],
            base_data['venueState'],
            base_data['venueCountry'],
            base_data['venueZip']
        )
        base_data.update(parsed_address)
        
        # Add summary as JSON string
        summary = booking.get('summary', [])
        base_data['summary'] = ', '.join(summary) if summary else ''
        
        # Process arrays: create a row for each item
        info_items = booking.get('info', [])
        other_contacts = booking.get('otherContacts', [])
        services = booking.get('services', [])
        expenses = booking.get('expenses', [])
        
        # Determine max length to know how many rows we need
        max_items = max(
            len(info_items) if info_items else 0,
            len(other_contacts) if other_contacts else 0,
            len(services) if services else 0,
            len(expenses) if expenses else 0,
            1  # At least one row even if all arrays are empty
        )
        
        # Create a row for each item
        for i in range(max_items):
            row = base_data.copy()
            
            # Add info data if exists
            if info_items and i < len(info_items):
                info = info_items[i]
                row['info_orderPos'] = info.get('orderPos', '')
                row['info_heading'] = info.get('heading', '')
                row['info_info'] = info.get('info', '')
                row['info_requestFromPromoter'] = info.get('requestFromPromoter', '')
            else:
                row['info_orderPos'] = ''
                row['info_heading'] = ''
                row['info_info'] = ''
                row['info_requestFromPromoter'] = ''
            
            # Add other contact data if exists
            if other_contacts and i < len(other_contacts):
                contact = other_contacts[i]
                row['otherContact_section'] = contact.get('section', '')
                row['otherContact_personId'] = contact.get('personId', '')
                row['otherContact_label'] = contact.get('label', '')
                row['otherContact_name'] = contact.get('name', '')
                row['otherContact_shareContactInfo'] = contact.get('shareContactInfo', '')
            else:
                row['otherContact_section'] = ''
                row['otherContact_personId'] = ''
                row['otherContact_label'] = ''
                row['otherContact_name'] = ''
                row['otherContact_shareContactInfo'] = ''
            
            # Add service data if exists
            if services and i < len(services):
                service = services[i]
                row['service_expenseId'] = service.get('expenseId', '')
                row['service_service'] = service.get('service', '')
                row['service_dueDate'] = service.get('dueDate', '')
                row['service_pricing'] = service.get('pricing', '')
                row['service_costPrice'] = service.get('costPrice', '')
                row['service_costPriceTaxRate'] = service.get('costPriceTaxRate', '')
                row['service_costPriceTax'] = service.get('costPriceTax', '')
                row['service_salePrice'] = service.get('salePrice', '')
                row['service_salePriceTaxRate'] = service.get('salePriceTaxRate', '')
                row['service_salePriceTax'] = service.get('salePriceTax', '')
                row['service_commission'] = service.get('commission', '')
                row['service_commissionAmount'] = service.get('commissionAmount', '')
                row['service_commissionTaxRate'] = service.get('commissionTaxRate', '')
                row['service_commissionTax'] = service.get('commissionTax', '')
                row['service_finalTotal'] = service.get('finalTotal', '')
                row['service_paidToArtiste'] = service.get('paidToArtiste', '')
            else:
                row['service_expenseId'] = ''
                row['service_service'] = ''
                row['service_dueDate'] = ''
                row['service_pricing'] = ''
                row['service_costPrice'] = ''
                row['service_costPriceTaxRate'] = ''
                row['service_costPriceTax'] = ''
                row['service_salePrice'] = ''
                row['service_salePriceTaxRate'] = ''
                row['service_salePriceTax'] = ''
                row['service_commission'] = ''
                row['service_commissionAmount'] = ''
                row['service_commissionTaxRate'] = ''
                row['service_commissionTax'] = ''
                row['service_finalTotal'] = ''
                row['service_paidToArtiste'] = ''
            
            # Add expense data if exists
            if expenses and i < len(expenses):
                expense = expenses[i]
                row['expense_date'] = expense.get('date', '')
                row['expense_name'] = expense.get('name', '')
                row['expense_type'] = expense.get('type', '')
                row['expense_displayAmount'] = expense.get('displayAmount', '')
                row['expense_amount'] = expense.get('amount', '')
                row['expense_tax'] = expense.get('tax', '')
                row['expense_currencyCode'] = expense.get('currencyCode', '')
                row['expense_paidToArtiste'] = expense.get('paidToArtiste', '')
                row['expense_statementId'] = expense.get('statementId', '')
            else:
                row['expense_date'] = ''
                row['expense_name'] = ''
                row['expense_type'] = ''
                row['expense_displayAmount'] = ''
                row['expense_amount'] = ''
                row['expense_tax'] = ''
                row['expense_currencyCode'] = ''
                row['expense_paidToArtiste'] = ''
                row['expense_statementId'] = ''
            
            all_rows.append(row)
        
        successful += 1
        
        # Progress update
        if idx % 10 == 0:
            print(f"Progress: {idx}/{len(booking_ids)} bookings processed ({successful} successful, {failed} failed)")
        
        # Rate limiting
        time.sleep(0.3)
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            print("Token expired, getting new token...")
            token_response = requests.post(TOKEN_URL, json=token_payload)
            access_token = token_response.json()["access_token"]
            headers["Authorization"] = f"Bearer {access_token}"
            # Don't increment idx, retry this booking
            continue
        else:
            print(f"Error fetching booking {booking_id}: {e}")
            failed += 1
            continue
    except Exception as e:
        print(f"Error processing booking {booking_id}: {e}")
        failed += 1
        continue

print(f"\n✓ Fetching complete!")
print(f"Successfully processed: {successful}/{len(booking_ids)}")
print(f"Failed: {failed}/{len(booking_ids)}")
print(f"Total rows created: {len(all_rows)}")

# Step 4: Write to CSV
if all_rows:
    print("\nWriting to CSV...")
    
    output_file = 'bookings_detailed_export.csv'
    
    # Get all unique keys from all rows
    all_keys = set()
    for row in all_rows:
        all_keys.update(row.keys())
    
    # Sort fieldnames for consistent output
    fieldnames = sorted(all_keys)
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)
    
    print(f"✓ Export complete! File saved as: {output_file}")
    print(f"Total rows exported: {len(all_rows)}")
    print(f"Total columns: {len(fieldnames)}")
else:
    print("\nNo data to export.")