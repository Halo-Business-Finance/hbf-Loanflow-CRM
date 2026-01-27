import React, { useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { Input } from './input'
import { useToast } from '@/hooks/use-toast'

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void
  placeholder?: string
  className?: string
  id?: string
}

export function AddressAutocomplete({ 
  value, 
  onChange, 
  onPlaceSelected,
  placeholder = "Enter address...",
  className,
  id
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const initializeAutocomplete = async () => {
      try {
        const apiKey = await getGoogleMapsApiKey()
        
        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places']
        })

        await loader.load()

        if (inputRef.current && !autocompleteRef.current) {
          autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
            types: ['address'],
            componentRestrictions: { country: 'us' }, // Restrict to US addresses
            fields: ['formatted_address', 'address_components', 'geometry', 'place_id']
          })

          autocompleteRef.current.addListener('place_changed', () => {
            try {
              const place = autocompleteRef.current?.getPlace()
              if (place && place.formatted_address) {
                onChange(place.formatted_address)
                onPlaceSelected?.(place)
              }
            } catch (error) {
              console.error('Error processing place selection:', error)
            }
          })
        }

        setIsLoaded(true)
      } catch (error) {
        console.error('Error loading Google Maps:', error)
        toast({
          title: "Maps API Error",
          description: "Could not load address autocomplete. Please enter address manually.",
          variant: "destructive"
        })
      }
    }

    initializeAutocomplete()

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [])

  const getGoogleMapsApiKey = async (): Promise<string> => {
    try {
      // Get API key securely from edge function
      const signature = 'secure-api-call-' + new Date().toDateString();
      const response = await fetch(`https://gshxxsniwytjgcnthyfq.supabase.co/functions/v1/secure-external-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_google_maps_key',
          signature
        })
      })

      if (response.ok) {
        const data = await response.json()
        return data.apiKey
      }
    } catch (error) {
      console.warn('Failed to get API key from edge function:', error)
    }

    throw new Error('Google Maps API key is required for address autocomplete. Please configure it in Supabase secrets.')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={handleInputChange}
        placeholder={isLoaded ? placeholder : "Loading address autocomplete..."}
        className={className}
        disabled={!isLoaded}
      />
      {!isLoaded && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  )
}