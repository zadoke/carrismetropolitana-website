'use client';

import useSWR from 'swr';
import { Combobox, TextInput, useCombobox, ActionIcon, Group } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './LinesExplorerToolbarSelectLine.module.css';
import useSearch from '@/hooks/useSearch';
import { IconX, IconSearch } from '@tabler/icons-react';
import { useLinesExplorerContext } from '@/contexts/LinesExplorerContext';
import { useDebouncedValue } from '@mantine/hooks';
import LineDisplay from '../LineDisplay/LineDisplay';

/* * */

export default function LinesExplorerToolbarSelectLine() {
  //

  //
  // A. Setup variables

  const t = useTranslations('LinesExplorerToolbarSelectLine');
  const linesExplorerContext = useLinesExplorerContext();
  const comboboxStore = useCombobox();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebouncedValue(searchQuery, 300);

  //
  // B. Fetch data

  const { data: allLinesData } = useSWR('https://api.carrismetropolitana.pt/lines');

  //
  // C. Transform data

  const allLinesDataFormatted = useMemo(() => {
    if (allLinesData) {
      let allLinesDataFiltered = allLinesData;
      if (linesExplorerContext.entities.municipality) {
        allLinesDataFiltered = allLinesDataFiltered.filter((line) => new Set(line.municipalities).has(linesExplorerContext.entities.municipality?.id));
      }
      return allLinesDataFiltered.map((line) => {
        return {
          id: line.id,
          short_name: line.short_name,
          long_name: line.long_name,
          color: line.color,
          text_color: line.text_color,
          localities: line.localities.join(', '),
        };
      });
    }
  }, [allLinesData, linesExplorerContext.entities.municipality]);

  //
  // D. Search

  const allLinesDataFilteredBySearchQuery = useSearch(debouncedSearchQuery, allLinesDataFormatted, {
    keys: ['id', 'short_name', 'long_name', 'localities'],
    regexReplace: /[^a-zA-Z0-9\s]/g,
  });

  //
  // E. Handle actions

  const handleClickSearchField = ({ currentTarget }) => {
    if (currentTarget.select) currentTarget.select();
    comboboxStore.openDropdown();
    comboboxStore.focusTarget();
  };

  const handleExitSearchField = () => {
    comboboxStore.closeDropdown();
  };

  const handleClearSearchField = () => {
    setSearchQuery('');
    linesExplorerContext.clearSelectedLine();
    comboboxStore.openDropdown();
  };

  const handleSearchQueryChange = ({ currentTarget }) => {
    setSearchQuery(currentTarget.value);
    comboboxStore.updateSelectedOptionIndex();
    comboboxStore.openDropdown();
  };

  const handleSelectLine = (chosenSelectItemValue) => {
    linesExplorerContext.selectLine(chosenSelectItemValue);
    comboboxStore.closeDropdown();
  };

  //
  // F. Render components

  return (
    <div className={styles.container}>
      <Combobox onOptionSubmit={handleSelectLine} store={comboboxStore}>
        <Combobox.Target>
          {linesExplorerContext.entities.line?.id && !comboboxStore.dropdownOpened ? (
            <Group className={styles.comboboxTarget} onClick={handleClickSearchField}>
              <IconSearch size={20} />
              <LineDisplay short_name={linesExplorerContext.entities.line?.short_name} long_name={linesExplorerContext.entities.line?.long_name} color={linesExplorerContext.entities.line?.color} text_color={linesExplorerContext.entities.line?.text_color} />
              <ActionIcon onClick={handleClearSearchField} size="md" variant="subtle" color="gray">
                <IconX size={20} />
              </ActionIcon>
            </Group>
          ) : (
            <TextInput
              autoComplete="off"
              type="search"
              aria-label={t('label')}
              placeholder={t('placeholder')}
              value={searchQuery}
              size="lg"
              leftSection={<IconSearch size={20} />}
              rightSection={
                searchQuery && (
                  <ActionIcon onClick={handleClearSearchField} size="md" variant="subtle" color="gray">
                    <IconX size={20} />
                  </ActionIcon>
                )
              }
              onChange={handleSearchQueryChange}
              onClick={handleClickSearchField}
              onFocus={handleClickSearchField}
              onBlur={handleExitSearchField}
            />
          )}
        </Combobox.Target>

        <Combobox.Dropdown>
          <Combobox.Options mah={200} style={{ overflowY: 'auto' }}>
            {allLinesDataFilteredBySearchQuery.length === 0 ? (
              <Combobox.Empty>{t('no_results')}</Combobox.Empty>
            ) : (
              allLinesDataFilteredBySearchQuery.map((item) => (
                <Combobox.Option key={item.id} value={item.id} className={item.id === linesExplorerContext.entities.line?.id && styles.selected}>
                  <div className={styles.comboboxOption}>
                    <LineDisplay short_name={item.short_name} long_name={item.long_name} color={item.color} text_color={item.text_color} />
                  </div>
                </Combobox.Option>
              ))
            )}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
    </div>
  );
}
